import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValidateAdminUseCase } from '../auth/validate-admin.use-case';
import {
  ReclassifySaleInput,
  ReclassifySaleResult,
} from '../../../domain/ports/out/reclassification.interface';

@Injectable()
export class ReclassifySaleUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validateAdminUseCase: ValidateAdminUseCase,
  ) {}

  async execute(input: ReclassifySaleInput): Promise<ReclassifySaleResult> {
    // 1. Validar PIN de supervisor/administrador
    try {
      await this.validateAdminUseCase.execute({
        storeId: input.storeId,
        password: input.adminPin,
      });
    } catch {
      throw new UnauthorizedException('PIN de Administrador inválido para autorizar reclasificación');
    }

    if (!input.motivo || input.motivo.trim().length === 0) {
      throw new BadRequestException('El motivo de la reclasificación es obligatorio.');
    }

    if (!input.nuevoMetodoPago && !input.nuevoCliente) {
      throw new BadRequestException('Debe especificar un nuevo método de pago o un nuevo cliente.');
    }

    // 2. Buscar la venta
    const venta = await this.prisma.venta.findFirst({
      where: {
        OR: [
          { idTransaccionPos: input.saleId },
          { numeroDocumento: input.saleId },
        ],
      },
      include: {
        pagosVenta: true,
      },
    });

    if (!venta) {
      throw new NotFoundException(`No se encontró la venta con identificador ${input.saleId}`);
    }

    // No permitir reclasificación en ventas a crédito
    if (venta.tipoFacturacion === 2) {
      throw new BadRequestException(
        'Las ventas a crédito no pueden reclasificarse directamente en el POS; deben revertirse mediante Nota de Crédito en Backoffice.',
      );
    }

    // 3. Obtener el turno asociado
    let idTurno = venta.idTurno;
    if (!idTurno) {
      // Buscar el turno a través de registro_transaccion
      const reg = await this.prisma.registroTransaccion.findFirst({
        where: { idTransaccionPos: venta.idTransaccionPos },
        select: { idTurno: true },
      });
      idTurno = reg?.idTurno || null;
    }

    if (!idTurno) {
      throw new BadRequestException('No se pudo identificar el turno asociado a esta venta.');
    }

    const turno = await this.prisma.turno.findUnique({
      where: { idTransaccionPos: idTurno },
    });

    if (!turno) {
      throw new NotFoundException(`No se encontró el turno ${idTurno} asociado a la venta.`);
    }

    // 4. Determinar si el turno está abierto o cerrado
    const isShiftClosed = Boolean(turno.finTurno);

    // En POS, la regla de negocio acordada exige que la corrección operativa de pista sea en turno abierto
    if (isShiftClosed) {
      throw new BadRequestException(
        'El turno asociado a esta venta ya se encuentra cerrado. Las modificaciones posteriores deben gestionarse a través de auditoría en Backoffice.',
      );
    }

    const currentShiftVersion = turno.version ?? 1;

    // 5. Preparar datos de auditoría
    const tipoCambio =
      input.nuevoMetodoPago && input.nuevoCliente
        ? 'AMBOS'
        : input.nuevoMetodoPago
        ? 'FORMA_PAGO'
        : 'CLIENTE_CONTADO';

    const datosOriginales = {
      cliente: {
        codigo: venta.codigoCliente,
        nombre: venta.nombreCliente,
        rtn: venta.rtnCliente,
      },
      pagos: venta.pagosVenta.map((p) => ({
        numeroLineaPago: p.numeroLineaPago,
        codigoMetodoPago: p.codigoMetodoPago,
        descripcion: p.descripcion,
        monto: Number(p.monto ?? 0),
        montoIngresado: Number(p.montoIngresado ?? 0),
      })),
    };

    const datosNuevos: Record<string, any> = {};
    if (input.nuevoCliente) {
      datosNuevos.cliente = {
        codigo: input.nuevoCliente.codigo,
        nombre: input.nuevoCliente.nombre,
        rtn: input.nuevoCliente.rtn ?? null,
      };
    } else {
      datosNuevos.cliente = datosOriginales.cliente;
    }

    if (input.nuevoMetodoPago) {
      datosNuevos.pagos = [
        {
          codigoMetodoPago: input.nuevoMetodoPago.codigoMetodoPago,
          descripcion: input.nuevoMetodoPago.descripcion ?? null,
          referencia: input.nuevoMetodoPago.referencia ?? null,
          monto: Number(venta.monto ?? 0),
        },
      ];
    } else {
      datosNuevos.pagos = datosOriginales.pagos;
    }

    // 6. Ejecutar transacción atómica
    const result = await this.prisma.$transaction(async (tx) => {
      // a) Actualizar datos de cliente si aplica
      if (input.nuevoCliente) {
        await tx.venta.update({
          where: {
            numeroEmisor_idTransaccionPos: {
              numeroEmisor: venta.numeroEmisor,
              idTransaccionPos: venta.idTransaccionPos,
            },
          },
          data: {
            codigoCliente: input.nuevoCliente.codigo,
            nombreCliente: input.nuevoCliente.nombre,
            rtnCliente: input.nuevoCliente.rtn ?? null,
          },
        });
      }

      // b) Actualizar pagos si aplica
      if (input.nuevoMetodoPago) {
        await tx.pagoVenta.deleteMany({
          where: { idTransaccionPos: venta.idTransaccionPos },
        });

        await tx.pagoVenta.create({
          data: {
            numeroLineaPago: 1,
            idTransaccionPos: venta.idTransaccionPos,
            numeroEmisor: venta.numeroEmisor,
            idTienda: venta.idTienda,
            codigoPos: venta.codigoPos,
            codigoMetodoPago: input.nuevoMetodoPago.codigoMetodoPago,
            descripcion: input.nuevoMetodoPago.descripcion || null,
            datosAdicionales: input.nuevoMetodoPago.referencia || null,
            monto: venta.monto,
            montoIngresado: venta.monto,
            esTicket: venta.tipoDocumento === 2,
          },
        });
      }

      // c) Crear registro de auditoría inmutable
      await tx.ventaReclasificacion.create({
        data: {
          idVenta: venta.idTransaccionPos,
          idTurno: turno.idTransaccionPos,
          versionTurno: currentShiftVersion,
          idUsuarioSolicita: input.requestedByUser,
          idUsuarioAutoriza: input.supervisorUser || 'ADMIN',
          tipoCambio,
          datosOriginales,
          datosNuevos,
          motivo: input.motivo.trim(),
        },
      });

      // d) Recalcular totales del turno activo
      const dayStart = new Date(turno.inicioTurno);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const turnoNum = turno.turno?.toString() || '';

      const txs = await tx.registroTransaccion.findMany({
        where: {
          numeroTurno: turnoNum,
          fechaTurno: { gte: dayStart, lte: dayEnd },
          tipoTransaccion: { in: [1, 2, 3] },
        },
        select: { idTransaccionPos: true },
      });
      const ids = txs.map((t) => t.idTransaccionPos);

      const allVentas = ids.length
        ? await tx.venta.findMany({
            where: { idTransaccionPos: { in: ids }, tipoFacturacion: 1 },
            select: { monto: true },
          })
        : [];
      const nuevoImporteContado = Math.round(
        allVentas.reduce((s, v) => s + Number(v.monto || 0), 0) * 100,
      ) / 100;

      const allPagos = ids.length
        ? await tx.pagoVenta.findMany({
            where: { idTransaccionPos: { in: ids } },
            select: { codigoMetodoPago: true, monto: true },
          })
        : [];

      const nuevoDetallePagos: Record<string, any> = {};
      for (const p of allPagos) {
        const key = p.codigoMetodoPago || 'OTRO';
        nuevoDetallePagos[key] = Math.round(
          ((nuevoDetallePagos[key] || 0) + Number(p.monto || 0)) * 100,
        ) / 100;
      }

      // Mantener efectivoDeclarado si existía
      const prevDetalle = (turno.detallePagos as Record<string, any>) || {};
      if (prevDetalle.efectivoDeclarado !== undefined) {
        nuevoDetallePagos.efectivoDeclarado = prevDetalle.efectivoDeclarado;
      }

      await tx.turno.update({
        where: { idTransaccionPos: turno.idTransaccionPos },
        data: {
          importeContado: nuevoImporteContado,
          detallePagos: nuevoDetallePagos,
        },
      });

      return {
        importeContado: nuevoImporteContado,
        detallePagos: nuevoDetallePagos,
      };
    });

    return {
      success: true,
      ventaId: venta.idTransaccionPos,
      turnoId: turno.idTransaccionPos,
      versionTurno: currentShiftVersion,
      mensaje: 'Reclasificación realizada exitosamente.',
      totalesTurnoActualizados: result,
    };
  }
}

import { Injectable } from '@nestjs/common';
import type { Turno } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ShiftRepository,
  AvailableShift,
  SalesReportData,
  ShiftSalesLine,
  ShiftSalePayment,
  ShiftSaleHeader,
} from '../../../domain/ports/out/shift-repository.interface';
import {
  Shift,
  OpenShiftCommand,
  CloseShiftCommand,
} from '../../../domain/entities/shift.entity';
import { toServerIso } from '../../../utils/datetime';
import { padStoreId, nextTrId } from '../../../utils/correlativos';
import { lockSeriesForUpdate } from '../series-lock';

@Injectable()
export class ShiftRepositoryImpl implements ShiftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpenShift(
    storeId: string,
    posNo: string,
    employeeName?: string,
  ): Promise<Shift | null> {
    const gasStationCode = padStoreId(storeId);
    const row = await this.prisma.turno.findFirst({
      where: {
        idTienda: gasStationCode,
        ...(employeeName ? { nombreEmpleado: employeeName } : {}),
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (!row) return null;
    return this.mapShift(row);
  }

  async findOpenShiftFromDb(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<any> {
    const gasStationCode = padStoreId(storeId);
    const row = await this.prisma.turno.findFirst({
      where: {
        idTienda: gasStationCode,
        nombreEmpleado: employeeName,
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (!row) {
      return { Message: 'No open shift found', Shift: null };
    }
    return {
      Shift: row.turno?.toString() || '1',
      'POS Transaction ID': row.idTransaccionPos || 'TX-DEFAULT',
      'Shift Starting': toServerIso(row.inicioTurno),
    };
  }

  async getOpenShiftByEmployee(
    storeId: string,
    employeeName: string,
  ): Promise<any> {
    const gasStationCode = padStoreId(storeId);
    const row = await this.prisma.turno.findFirst({
      where: {
        nombreEmpleado: employeeName,
        idTienda: gasStationCode,
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (!row) {
      return { Message: 'No open shift found', Shift: null };
    }
    return {
      Shift: row.turno || '1',
      'POS Transaction ID': row.idTransaccionPos || 'TX-DEFAULT',
      'Shift Starting': toServerIso(row.inicioTurno),
      MontoInicial: row.montoInicial ?? 0,
      EmployeeName: row.nombreEmpleado,
    };
  }

  async createShift(dto: OpenShiftCommand): Promise<Shift> {
    const gasStationCode = padStoreId(dto.storeId);
    const posNo = dto.posNo.trim();

    const nextShiftNo =
      dto.shiftNumber ??
      (await this.getNextShiftNumber(gasStationCode, dto.employeeName));

    const maxTurnos = 99;
    if (maxTurnos > 0 && nextShiftNo > maxTurnos) {
      throw new Error(
        `No se permite crear más de ${maxTurnos} turnos en esta tienda.`,
      );
    }

    if (dto.shiftNumber !== undefined && dto.shiftNumber !== null) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const existing = await this.prisma.turno.findFirst({
        where: {
          turno: dto.shiftNumber.toString(),
          nombreEmpleado: dto.employeeName,
          idTienda: gasStationCode,
          inicioTurno: { gte: todayStart, lte: todayEnd },
        },
      });
      if (existing) {
        throw new Error(
          `El turno ${dto.shiftNumber} ya fue creado por usted el día de hoy.`,
        );
      }
    }

    // Validar que no haya turno abierto
    const openShift = await this.prisma.turno.findFirst({
      where: {
        idTienda: gasStationCode,
        nombreEmpleado: dto.employeeName,
        finTurno: null,
      },
    });
    if (openShift) {
      throw new Error(
        'Ya hay un turno abierto para este empleado en la estación.',
      );
    }

    // Obtener y bloquear el correlativo TR-ID dentro de la transacción para
    // evitar que dos POS asignen el mismo número de transacción.
    const now = new Date();

    const shift = await this.prisma.$transaction(
      async (tx) => {
        const trSeries = await lockSeriesForUpdate(
          tx,
          'TR-ID',
          gasStationCode,
          posNo,
          now,
          true,
        );

        if (!trSeries || !trSeries.ultimoNumeroUsado) {
          throw new Error('No se pudo obtener el número de transacción.');
        }

        const nextPosTransactionId = nextTrId(trSeries.ultimoNumeroUsado);

        const created = await tx.turno.create({
          data: {
            idTransaccionPos: nextPosTransactionId,
            idTienda: gasStationCode,
            codigoPos: posNo,
            turno: nextShiftNo.toString(),
            inicioTurno: new Date(),
            finTurno: null,
            importeContado: dto.initialAmount,
            nombreEmpleado: dto.employeeName,
            montoInicial: dto.initialAmount,
          },
        });

        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: 'TR-ID',
            numeroLinea: trSeries.numeroLinea,
            idTienda: gasStationCode,
            codigoPos: posNo,
          },
          data: {
            ultimoNumeroUsado: nextPosTransactionId,
            ultimaFechaUsada: new Date(),
          },
        });

        return created;
      },
      { isolationLevel: 'ReadCommitted' },
    );

    return this.mapShift(shift);
  }

  async getOpenShiftSaleIds(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<number[]> {
    const gasStationCode = padStoreId(storeId);
    void posNo;

    const openShift = await this.prisma.turno.findFirst({
      where: {
        idTienda: gasStationCode,
        nombreEmpleado: employeeName,
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (!openShift) return [];

    const dayStart = new Date(openShift.inicioTurno);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const turnoNum = openShift.turno?.toString() || '';

    const txs = await this.prisma.registroTransaccion.findMany({
      where: {
        numeroTurno: turnoNum,
        fechaTurno: { gte: dayStart, lte: dayEnd },
        tipoTransaccion: { in: [1, 2, 3] },
      },
      select: { idTransaccionPos: true },
    });
    const ids = txs.map((t) => t.idTransaccionPos);

    const lineas = ids.length
      ? await this.prisma.lineaVenta.findMany({
          where: { idTransaccionPos: { in: ids }, idVenta: { not: null } },
          distinct: ['idVenta'],
          select: { idVenta: true },
        })
      : [];
    return lineas
      .map((l) => Number(l.idVenta))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async closeShift(dto: CloseShiftCommand): Promise<{ success: boolean }> {
    const gasStationCode = padStoreId(dto.storeId);

    const openShift = await this.prisma.turno.findFirst({
      where: {
        idTienda: gasStationCode,
        nombreEmpleado: dto.employeeName,
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (!openShift) {
      throw new Error('No hay turno abierto para cerrar.');
    }

    // Día del turno (sus transacciones comparten fechaTurno = inicio del turno)
    const dayStart = new Date(openShift.inicioTurno);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const turnoNum = openShift.turno?.toString() || '';

    const txs = await this.prisma.registroTransaccion.findMany({
      where: {
        numeroTurno: turnoNum,
        fechaTurno: { gte: dayStart, lte: dayEnd },
        tipoTransaccion: { in: [1, 2, 3] },
      },
      select: { idTransaccionPos: true },
    });
    const ids = txs.map((t) => t.idTransaccionPos);

    const ventas = ids.length
      ? await this.prisma.venta.findMany({
          where: { idTransaccionPos: { in: ids }, tipoFacturacion: 1 },
          select: { monto: true },
        })
      : [];
    const importeContado = Math.round(
      ventas.reduce((s, v) => s + Number(v.monto || 0), 0) * 100,
    ) / 100;

    const pagos = ids.length
      ? await this.prisma.pagoVenta.findMany({
          where: { idTransaccionPos: { in: ids } },
          select: { codigoMetodoPago: true, monto: true },
        })
      : [];
    const detallePagos: Record<string, any> = {};
    for (const p of pagos) {
      const key = p.codigoMetodoPago || 'OTRO';
      detallePagos[key] = Math.round(
        ((detallePagos[key] || 0) + Number(p.monto || 0)) * 100,
      ) / 100;
    }
    if (dto.actualAmount !== undefined && dto.actualAmount !== null) {
      detallePagos.efectivoDeclarado = Number(dto.actualAmount);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.turno.update({
          where: { idTransaccionPos: openShift.idTransaccionPos },
          data: {
            finTurno: new Date(),
            importeContado,
            posCierre: dto.posNo,
            detallePagos,
          },
        });

        await tx.registroTransaccion.updateMany({
          where: {
            OR: [
              { idTurno: openShift.idTransaccionPos },
              {
                numeroTurno: turnoNum,
                fechaTurno: { gte: dayStart, lte: dayEnd },
              },
            ],
          },
          data: { estado: true },
        });

        await tx.registroTransaccion.create({
          data: {
            idTransaccionPos: openShift.idTransaccionPos,
            idTienda: gasStationCode,
            codigoPos: dto.posNo,
            fechaTurno: new Date(openShift.inicioTurno),
            numeroTurno: turnoNum,
            idTurno: openShift.idTransaccionPos,
            tipoTransaccion: 4,
            fechaHoraTransaccion: new Date(),
            nombreEmpleado: dto.employeeName,
            estado: true,
          },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );

    return { success: true };
  }

  async countTurnoControladorByPeriod(_periodId: string): Promise<number> {
    return 0;
  }

  async createTurnoControlador(_data: {
    periodId: string;
    startDate: string;
    startTime: string;
    additionalDetails: string;
  }): Promise<void> {
    // Obsoleto: tabla turnos_controlador eliminada
  }

  async getAvailableShifts(
    storeId: string,
    fechaTurno: string,
  ): Promise<AvailableShift[]> {
    const gasStationCode = padStoreId(storeId);
    const dayStart = new Date(`${fechaTurno}T00:00:00`);
    const dayEnd = new Date(`${fechaTurno}T23:59:59`);

    const rows = await this.prisma.registroTransaccion.findMany({
      where: {
        idTienda: gasStationCode,
        fechaTurno: { gte: dayStart, lte: dayEnd },
      },
      distinct: ['numeroTurno', 'codigoPos', 'nombreEmpleado'],
      select: { numeroTurno: true, codigoPos: true, nombreEmpleado: true },
    });

    return rows.map((r) => ({
      Turno: r.numeroTurno,
      PosCode: r.codigoPos,
      Cajero: r.nombreEmpleado,
    }));
  }

  async getSalesReportData(
    storeId: string,
    turno: string,
    employeeName: string,
    fechaTurno: string,
  ): Promise<SalesReportData> {
    const gasStationCode = padStoreId(storeId);
    const dayStart = new Date(`${fechaTurno}T00:00:00`);
    const dayEnd = new Date(`${fechaTurno}T23:59:59`);

    const txRows = await this.prisma.registroTransaccion.findMany({
      where: {
        idTienda: gasStationCode,
        numeroTurno: turno,
        nombreEmpleado: employeeName,
        fechaTurno: { gte: dayStart, lte: dayEnd },
      },
      select: { idTransaccionPos: true },
    });
    const txIds = [...new Set(txRows.map((r) => r.idTransaccionPos))];

    const lines: ShiftSalesLine[] = [];
    const payments: ShiftSalePayment[] = [];
    const headers: ShiftSaleHeader[] = [];
    if (txIds.length > 0) {
      const rawLines = await this.prisma.lineaVenta.findMany({
        where: { idTransaccionPos: { in: txIds } },
      });
      const rawPayments = await this.prisma.pagoVenta.findMany({
        where: { idTransaccionPos: { in: txIds } },
      });
      const rawHeaders = await this.prisma.venta.findMany({
        where: { idTransaccionPos: { in: txIds } },
      });
      const methodCodes = rawPayments
        .map((p) => p.codigoMetodoPago)
        .filter((c): c is string => !!c);
      const methodRows = methodCodes.length
        ? await this.prisma.metodoPago.findMany({
            where: { codigo: { in: methodCodes } },
          })
        : [];
      const methodMap = new Map(methodRows.map((m) => [m.codigo, m.descripcion]));
for (const l of rawLines) {
        lines.push({
          numeroBomba: l.numeroBomba,
          descripcion: l.descripcion,
          montoConIsv: l.montoConIsv != null ? Number(l.montoConIsv) : null,
          grupoIsv: l.grupoIsv,
          montoIsv: l.montoIsv != null ? Number(l.montoIsv) : null,
          montoDescuentoLinea:
            l.montoDescuentoLinea != null ? Number(l.montoDescuentoLinea) : null,
          cantidad: l.cantidad != null ? Number(l.cantidad) : null,
          unidadMedida: l.unidadMedida ?? null,
        });
      }
      for (const p of rawPayments) {
        payments.push({
          descripcion: p.descripcion,
          codigoMetodoPago: p.codigoMetodoPago,
          metodoPago: p.codigoMetodoPago
            ? methodMap.get(p.codigoMetodoPago) ?? null
            : null,
          monto: p.monto != null ? Number(p.monto) : null,
          montoIngresado:
            p.montoIngresado != null ? Number(p.montoIngresado) : null,
        });
      }
      for (const h of rawHeaders) {
        headers.push({
          monto: h.monto != null ? Number(h.monto) : null,
          tipoDocumento: h.tipoDocumento,
          origenValidacionCredito: (h as any).origenValidacionCredito ?? null,
        });
      }
    }

    return { lines, payments, headers };
  }

  private async getNextShiftNumber(
    storeId: string,
    employeeName: string,
  ): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const last = await this.prisma.turno.findFirst({
      where: {
        nombreEmpleado: employeeName,
        idTienda: storeId,
        inicioTurno: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (last && last.turno && /^\d+$/.test(last.turno)) {
      return parseInt(last.turno, 10) + 1;
    }
    return 1;
  }

  private mapShift(row: Turno): Shift {
    return {
      id: 0,
      isOpen: !row.finTurno,
      shiftNumber: row.turno?.toString() || '',
      storeId: row.idTienda || '',
      posNo: row.codigoPos || '',
      posCierre: row.posCierre || null,
      employeeName: row.nombreEmpleado || '',
      initialAmount: Number(row.montoInicial) || 0,
      actualAmount: null,
      posTransactionId: row.idTransaccionPos || '',
      shiftStarting: row.inicioTurno || new Date(),
      shiftEnding: row.finTurno || null,
      version: row.version ?? 1,
    };
  }

  async getShiftReclassifications(shiftId: string): Promise<any[]> {
    return this.prisma.ventaReclasificacion.findMany({
      where: { idTurno: shiftId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

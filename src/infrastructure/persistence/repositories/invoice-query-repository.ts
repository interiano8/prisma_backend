import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../src/generated/prisma/client';
import { SERIES } from '../../../domain/constants/business.constants';
import type { Turno } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { lockSeriesForUpdate } from '../series-lock';
import { InvoiceQueryRepository } from '../../../domain/ports/out/invoice-query-repository.interface';
import type {
  SearchInvoicesParams,
  OpenShiftRow,
  LealRow,
  CampanaRow,
  ReasonRow,
} from '../../../domain/ports/out/invoice-repository.interface';
import { padStoreId, nextInvoiceNumber, nextTrId } from '../../../utils/correlativos';

@Injectable()
export class InvoiceQueryRepositoryImpl implements InvoiceQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNextCorrelative(
    storeId: string,
    posNo: string,
  ): Promise<{ invoiceNo: string; posTransactionId: string }> {
    const gasStationCode = padStoreId(storeId);
    const invoiceNo = await this.peekCorrelative(
      gasStationCode,
      posNo,
      'FV-HN',
    );
    const posTransactionId = await this.peekCorrelative(
      gasStationCode,
      posNo,
      'TR-ID',
    );
    return { invoiceNo, posTransactionId };
  }

  private async peekCorrelative(
    storeId: string,
    posNo: string,
    seriesCode: string,
  ): Promise<string> {
    const now = new Date();
    const row = await this.prisma.serieDocumento.findFirst({
      where: {
        codigoSerie: seriesCode,
        abierta: true,
        idTienda: storeId,
        codigoPos: posNo,
        fechaInicio: { lte: now },
        OR: [{ fechaVenceRango: null }, { fechaVenceRango: { gte: now } }],
      },
      orderBy: { numeroLinea: 'asc' },
    });
    if (!row || !row.ultimoNumeroUsado) {
      // Sin rango válido: error claro, nunca un correlativo sintético.
      throw new Error(
        `No se encontró un rango válido (${seriesCode}) para predecir el correlativo en la terminal ${posNo}.`,
      );
    }
    return seriesCode === SERIES.TRANSACCION
      ? nextTrId(row.ultimoNumeroUsado)
      : nextInvoiceNumber(row.ultimoNumeroUsado);
  }

  async findNextCreditNoteCorrelative(
    storeId: string,
    posNo: string,
  ): Promise<{
    serieCode: string;
    nextInvoice: string;
    remainingInvoices: number;
    remainingDays: number;
  }> {
    const gasStationCode = padStoreId(storeId);
    const now = new Date();
    const row = await this.prisma.serieDocumento.findFirst({
      where: {
        codigoSerie: SERIES.NOTA_CREDITO,
        abierta: true,
        idTienda: gasStationCode,
        codigoPos: posNo,
        fechaInicio: { lte: now },
        OR: [{ fechaVenceRango: null }, { fechaVenceRango: { gte: now } }],
      },
      orderBy: { numeroLinea: 'asc' },
    });

    if (!row || !row.codigoSerie) {
      throw new Error(
        'No se encontró un rango configurado para Notas de Crédito.',
      );
    }

    const remainingInvoices = this.remainingInvoices(
      row.numeroFin,
      row.ultimoNumeroUsado,
    );
    const remainingDays = row.fechaVenceRango
      ? Math.floor((row.fechaVenceRango.getTime() - now.getTime()) / 86400000)
      : 0;

    if (remainingInvoices <= 0) {
      throw new Error('No hay correlativos disponibles para Notas de Crédito.');
    }
    if (remainingDays < 0) {
      throw new Error(
        'El rango de Notas de Crédito ha vencido. Agregue un nuevo rango.',
      );
    }

    return {
      serieCode: row.codigoSerie,
      nextInvoice: nextInvoiceNumber(row.ultimoNumeroUsado || ''),
      remainingInvoices,
      remainingDays,
    };
  }

  private remainingInvoices(
    endingNo: string | null | undefined,
    lastUsed: string | null | undefined,
  ): number {
    const e = endingNo ? parseInt(endingNo.substring(11), 10) : 0;
    const l = lastUsed ? parseInt(lastUsed.substring(11), 10) : 0;
    if (isNaN(e) || isNaN(l)) return 0;
    return e - l;
  }

  async validateCorrelative(
    storeId: string,
    posNo: string,
    isTicket: boolean,
  ): Promise<{ isValid: boolean; message: string; remaining?: number; remainingDays?: number }> {
    const seriesCode = isTicket ? SERIES.TICKET : SERIES.FACTURA;
    const gasStationCode = padStoreId(storeId);
    const now = new Date();

    // Usa la MISMA selección que la transacción de facturación (lockSeriesForUpdate):
    // recorre todos los rangos abiertos, cierra agotados/vencidos y salta al siguiente,
    // para no dar falsos negativos ni divergir de lo que el insert realmente elegiría.
    try {
      const { invSeries, trSeries } = await this.prisma.$transaction(async (tx) => {
        const inv = await lockSeriesForUpdate(
          tx,
          seriesCode,
          gasStationCode,
          posNo,
          now,
          true,
        );
        const tr = await lockSeriesForUpdate(
          tx,
          SERIES.TRANSACCION,
          gasStationCode,
          posNo,
          now,
          false,
        );
        return { invSeries: inv, trSeries: tr };
      });

      if (!invSeries) {
        return {
          isValid: false,
          message: `No se encontró un rango de correlativos (${seriesCode}) abierto y válido.\nSerie buscada: ${seriesCode} | Terminal: '${posNo}' | Estación: ${storeId}.`,
          remaining: 0,
          remainingDays: 0,
        };
      }

      if (!trSeries) {
        return {
          isValid: false,
          message: `No hay correlativo disponible para POS Transaction ID (TR-ID) en la terminal ${posNo}.`,
          remaining: invSeries.remaining,
          remainingDays: invSeries.remainingDays,
        };
      }

      return {
        isValid: true,
        message: 'Correlativo válido.',
        remaining: invSeries.remaining,
        remainingDays: invSeries.remainingDays,
      };
    } catch (e: any) {
      return { isValid: false, message: e?.message || 'No hay un rango de correlativos válido.' };
    }
  }

  // ===== Turnos =====

  async getShiftDetails(
    storeId: string,
    posNo: string,
    shiftNumber: string,
    employeeName?: string,
  ): Promise<{ shiftDate: Date | string; employeeName: string; shiftId: string | null }> {
    const gasStationCode = padStoreId(storeId);

    let row: Turno | null = null;
    if (employeeName && employeeName.trim().length > 0) {
      row = await this.prisma.turno.findFirst({
        where: {
          idTienda: gasStationCode,
          nombreEmpleado: employeeName.trim(),
          finTurno: null,
        },
        orderBy: { inicioTurno: 'desc' },
      });
    }
    if (!row) {
      row = await this.prisma.turno.findFirst({
        where: { idTienda: gasStationCode, turno: shiftNumber, finTurno: null },
        orderBy: { inicioTurno: 'desc' },
      });
    }

    if (!row) {
      throw new Error(
        `No se encontró un turno abierto para el usuario "${employeeName || shiftNumber}". Por favor abra un turno para poder facturar.`,
      );
    }

    return {
      shiftDate: row.inicioTurno,
      employeeName: row.nombreEmpleado || employeeName || 'SISTEMA',
      shiftId: row.idTransaccionPos,
    };
  }

  async getOpenShiftForEmployee(
    storeId: string,
    employeeName: string,
  ): Promise<OpenShiftRow | null> {
    const gasStationCode = padStoreId(storeId);
    const row = await this.prisma.turno.findFirst({
      where: {
        idTienda: gasStationCode,
        nombreEmpleado: employeeName,
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
    if (!row) return null;
    return {
      'Shift Starting': row.inicioTurno,
      EmployeeName: row.nombreEmpleado,
      Shift: row.turno,
      'POS Transaction ID': row.idTransaccionPos,
    };
  }

  async getOriginalDocument(
    invoiceNo: string,
    transactionId: string,
  ): Promise<any> {
    const row = await this.prisma.venta.findFirst({
      where: { numeroDocumento: invoiceNo, idTransaccionPos: transactionId },
    });
    if (!row) return null;
    return {
      'POS Sales Doc_ Type': row.tipoDocumento,
      'Customer No_': row.codigoCliente,
      Amount: row.monto,
      'VAT Reg_ No_': row.rtnCliente,
      'Cust_ Name': row.nombreCliente,
      'Billing Type': row.tipoFacturacion,
      SubTotal: row.subtotal,
      KM: row.kilometraje,
      Orden: row.orden,
      Placa: row.placaOrden,
      Chofer: row.chofer,
      Cambio: row.cambio,
      numeroLinea: row.numeroLinea,
    };
  }

  async checkExistingReversion(
    invoiceNo: string,
    transactionId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.venta.findFirst({
      where: { documentoRelacionado: invoiceNo },
    });
    if (existing) return true;

    const lines = await this.prisma.lineaVenta.findFirst({
      where: {
        OR: [
          { idTransaccionOrigen: transactionId },
          { documentoOrigen: invoiceNo },
        ],
      },
    });
    return !!lines;
  }

  async getInvoiceLines(transactionId: string): Promise<any[]> {
    const rows = await this.prisma.lineaVenta.findMany({
      where: { idTransaccionPos: transactionId },
      orderBy: { numeroLineaDocumento: 'asc' },
    });
    return rows.map((r) => ({
      'POS Sales No_': r.numeroVenta,
      Description: r.descripcion,
      Quantity: r.cantidad,
      'Unit Price Incl_ VAT': r.precioUnitarioConIsv,
      'Unit Discount Amount': r.montoDescuentoUnitario,
      'Discount _': r.descuento,
      'Line Discount Amount': r.montoDescuentoLinea,
      'VAT _': r.isv,
      VAT_Amount: r.montoIsv,
      'Amount Including VAT': r.montoConIsv,
      'Pump No_': r.numeroBomba,
      'Pump Position No_': r.posicionBomba,
      'Tank No_': r.numeroTanque,
      'Item Category Code': r.codigoCategoria,
      'Gen_ Pump Ledg_ Entry': r.generaAsientoBomba ? 1 : 0,
      'VAT Prod_ Posting Group': r.grupoIsv,
      SaleID: r.idVenta,
      IdTransaccionLeal: null,
      IDAleatorio: null,
    }));
  }

  async getInvoicePayments(transactionId: string): Promise<any[]> {
    const rows = await this.prisma.pagoVenta.findMany({
      where: { idTransaccionPos: transactionId },
      orderBy: { numeroLineaPago: 'asc' },
    });
    const codes = rows
      .map((r) => r.codigoMetodoPago)
      .filter((c): c is string => !!c);
    const methods = codes.length
      ? await this.prisma.metodoPago.findMany({
          where: { codigo: { in: codes } },
        })
      : [];
    const methodMap = new Map(methods.map((m) => [m.codigo, m]));
    return rows.map((r) => {
      const method = r.codigoMetodoPago
        ? methodMap.get(r.codigoMetodoPago)
        : undefined;
      return {
        'Charge Method Code': r.codigoMetodoPago,
        Amount: r.monto,
        MontoIngresado: r.montoIngresado,
        Description: r.descripcion,
        'Datos Adicionales': r.datosAdicionales,
        TasaCambio: r.tasaCambio,
        EsTicket: r.esTicket ? 1 : 0,
        'Card No_': r.numeroTarjeta,
        MetodoPago: method?.descripcion ?? undefined,
        Categoria: method?.categoria ?? undefined,
      };
    });
  }

  async getInvoiceLealTransactions(transactionId: string): Promise<LealRow[]> {
    try {
      const rows = await this.prisma.ventaLeal.findMany({
        where: { idTransaccionPos: transactionId },
      });
      return rows.map((r) => ({
        Tipo: r.tipo,
        Puntos: r.puntos,
        PuntosActivos: r.puntosActivos,
      }));
    } catch {
      return [];
    }
  }

  async getInvoiceCampanas(transactionId: string): Promise<CampanaRow[]> {
    try {
      const rows = await this.prisma.participacionCampana.findMany({
        where: { idTransaccionPos: transactionId },
      });
      const campanaIds = rows.map((r) => r.idCampana).filter((id) => id != null);
      const campanas = campanaIds.length
        ? await this.prisma.campana.findMany({
            where: { id: { in: campanaIds } },
          })
        : [];
      const campanaMap = new Map(campanas.map((s) => [s.id, s]));
      return rows.map((r) => ({
        campanaId: r.idCampana,
        nombre:
          r.idCampana != null ? campanaMap.get(r.idCampana)?.nombre : undefined,
        textoTicket:
          r.idCampana != null
            ? campanaMap.get(r.idCampana)?.textoTicket
            : undefined,
        correlativo: r.correlativo,
      }));
    } catch {
      return [];
    }
  }

  async findStoreConfigField(storeId: string, field: string): Promise<any> {
    const row = await this.prisma.configuracionTienda.findUnique({
      where: { idTienda: storeId },
    });
    if (!row?.config) return null;
    const config = row.config as Record<string, any>;
    return config[field] ?? null;
  }

  async getReasons(): Promise<ReasonRow[]> {
    return [];
  }

  async searchInvoices(
    params: SearchInvoicesParams,
  ): Promise<
    any[] | { total: number; page: number; pageSize: number; data: any[] }
  > {
    const gasStationCode = padStoreId(params.storeId);
    const where: Prisma.VentaWhereInput = { idTienda: gasStationCode };

    if (params.factura) {
      where.numeroDocumento = params.factura;
    }
    if (params.customerName) {
      where.nombreCliente = { contains: params.customerName };
    }

    if (params.avanzado) {
      const fechaHora: Prisma.DateTimeNullableFilter = {};
      if (params.fechaDesde) {
        fechaHora.gte = new Date(`${params.fechaDesde}T00:00:00`);
      }
      if (params.fechaHasta) {
        fechaHora.lte = new Date(`${params.fechaHasta}T23:59:59`);
      }
      if (Object.keys(fechaHora).length > 0) {
        where.fechaHoraVenta = fechaHora;
      }
    }

    if (params.employeeName || params.turno || params.fechaTurno) {
      const txWhere: Prisma.RegistroTransaccionWhereInput = {
        idTienda: gasStationCode,
      };
      if (params.posNo) txWhere.codigoPos = params.posNo;
      if (params.employeeName) {
        // nombre_empleado guarda el usuario en datos históricos y el nombre en
        // turnos abiertos desde la app; coincide con ambos para no perder resultados.
        txWhere.nombreEmpleado = params.employeeName;
        const emp = await this.prisma.empleado.findUnique({
          where: { usuario: params.employeeName },
          select: { nombre: true },
        });
        if (emp?.nombre && emp.nombre !== params.employeeName) {
          txWhere.nombreEmpleado = { in: [params.employeeName, emp.nombre] };
        }
      }
      if (params.turno) txWhere.numeroTurno = String(params.turno);
      if (params.fechaTurno) {
        const fechaTurnoFilter: Prisma.DateTimeNullableFilter = {};
        fechaTurnoFilter.gte = new Date(`${params.fechaTurno}T00:00:00`);
        fechaTurnoFilter.lte = new Date(`${params.fechaTurno}T23:59:59`);
        txWhere.fechaTurno = fechaTurnoFilter;
      }
      const txs = await this.prisma.registroTransaccion.findMany({
        where: txWhere,
        select: { idTransaccionPos: true },
      });
      where.idTransaccionPos = { in: txs.map((t) => t.idTransaccionPos) };
    }

    const page = params.page && params.page > 0 ? params.page : undefined;
    const pageSize =
      params.pageSize && params.pageSize > 0 ? params.pageSize : 200;
    const total = page ? await this.prisma.venta.count({ where }) : undefined;

    const pagination: { skip?: number; take: number } = page
      ? { skip: (page - 1) * pageSize, take: pageSize }
      : { take: 200 };

    const rows = await this.prisma.venta.findMany({
      where,
      orderBy: { fechaHoraVenta: 'desc' },
      ...pagination,
    });

    const ids = rows.map((r) => r.idTransaccionPos);
    const [lealRows, campanaRows, turnoRows] = await Promise.all([
      this.prisma.ventaLeal.findMany({
        where: { idTransaccionPos: { in: ids } },
        select: { idTransaccionPos: true },
      }),
      this.prisma.participacionCampana.findMany({
        where: { idTransaccionPos: { in: ids } },
        select: { idTransaccionPos: true },
      }),
      this.prisma.registroTransaccion.findMany({
        where: { idTransaccionPos: { in: ids } },
        select: { idTransaccionPos: true, numeroTurno: true, fechaTurno: true },
      }),
    ]);
    const lealSet = new Set(lealRows.map((r) => r.idTransaccionPos));
    const campanaSet = new Set(campanaRows.map((r) => r.idTransaccionPos));
    const turnoMap = new Map(
      turnoRows.map((t) => [t.idTransaccionPos, t]),
    );

    const data = rows.map((r) => ({
      'POS Sales Doc_ No_': r.numeroDocumento,
      'POS Transaction ID': r.idTransaccionPos,
      'POS Sales Doc_ Type': r.tipoDocumento,
      'Cust_ Name': r.nombreCliente,
      'Customer No_': r.codigoCliente,
      Amount: r.monto,
      'Sale Date Time': r.fechaHoraVenta,
      'VAT Reg_ No_': r.rtnCliente,
      EsCredito: r.tipoFacturacion === 0,
      TieneLeal: lealSet.has(r.idTransaccionPos),
      TieneCampana: campanaSet.has(r.idTransaccionPos),
      'Billing Type': r.tipoFacturacion,
      CAI: r.cai,
      RangoDesde: r.rangoDesde,
      RangoHasta: r.rangoHasta,
      FechaVence: r.fechaVenceRango,
      Turno: turnoMap.get(r.idTransaccionPos)?.numeroTurno ?? null,
      TurnoFecha: turnoMap.get(r.idTransaccionPos)?.fechaTurno ?? null,
      Comment: r.comentario,
      Plate: r.placa,
      Mileage: r.kilometraje,
      Order: r.orden,
      'Order Plate': r.placaOrden,
      Driver: r.chofer,
      Change: r.cambio,
      Subtotal: r.subtotal,
      'Related Document': r.documentoRelacionado,
      'Salesperson Code': r.codigoVendedor,
      'POS Code': r.codigoPos,
      'Emitter No_': r.numeroEmisor,
      'ERP ID': null,
      origenValidacionCredito: r.origenValidacionCredito ?? null,
      creditValidationSource: r.origenValidacionCredito ?? null,
    }));

    if (page) {
      return { total: total ?? 0, page, pageSize, data };
    }
    return data;
  }

  async findAll(): Promise<any[]> {
    const rows = await this.prisma.venta.findMany({
      orderBy: { fechaHoraVenta: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      invoiceNo: r.numeroDocumento,
      storeId: r.idTienda,
      posNo: r.codigoPos,
      customerName: r.nombreCliente,
      total: r.monto,
      createdAt: r.fechaHoraVenta,
    }));
  }

  async findByNo(invoiceNo: string): Promise<any> {
    return this.prisma.venta.findFirst({
      where: { numeroDocumento: invoiceNo },
    });
  }

  async getFidelizacionPaymentCodes(): Promise<string[]> {
    try {
      const rows = await this.prisma.metodoPago.findMany({
        where: {
          OR: [
            { fidelizacion: true },
            { categoria: 'FIDELIZACION' },
          ],
        },
        select: { codigo: true },
      });
      return rows.map((r) => r.codigo);
    } catch {
      return [];
    }
  }
}

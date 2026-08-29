import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../src/generated/prisma/client';
import type { Turno } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { lockSeriesForUpdate } from '../series-lock';
import {
  InvoiceRepository,
  InvoiceInsertParams,
  CreditNoteParams,
  SalesLineParams,
  PaymentMethodParams,
  LealTransactionParams,
  SearchInvoicesParams,
  InvoiceInsertResultRow,
  OpenShiftRow,
  LealRow,
  SorteoRow,
  ReasonRow,
  InvoiceLineRow,
  PaymentMethodRow,
} from '../../../domain/ports/out/invoice-repository.interface';
import {
  padStoreId,
  nextInvoiceNumber,
  nextTrId,
} from '../../../utils/correlativos';

@Injectable()
export class InvoiceRepositoryImpl implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Correlativos (reimplementa EINextInvoice / EINextPosTransactionIDNumber) =====

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
    return {
      invoiceNo:
        invoiceNo ||
        `FAC-${storeId}-${posNo}-${Date.now().toString().slice(-6)}`,
      posTransactionId: posTransactionId || `TR-${Date.now()}`,
    };
  }

  private async peekCorrelative(
    storeId: string,
    posNo: string,
    seriesCode: string,
  ): Promise<string | null> {
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
    if (!row || !row.ultimoNumeroUsado) return null;
    return seriesCode === 'TR-ID'
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
        codigoSerie: 'NC-HN',
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
  ): Promise<{ isValid: boolean; message: string }> {
    const seriesCode = isTicket ? 'TK-HN' : 'FV-HN';
    const gasStationCode = padStoreId(storeId);
    const now = new Date();

    const row = await this.prisma.serieDocumento.findFirst({
      where: {
        codigoSerie: seriesCode,
        abierta: true,
        idTienda: gasStationCode,
        codigoPos: posNo,
        fechaInicio: { lte: now },
      },
      orderBy: { numeroLinea: 'asc' },
    });

    if (!row) {
      return {
        isValid: false,
        message: `No se encontró un rango de correlativos (${seriesCode}) abierto y válido.\nSerie buscada: ${seriesCode} | Terminal: '${posNo}' | Estación: ${storeId}.`,
      };
    }

    const fechaVenceStr = row.fechaVenceRango
      ? row.fechaVenceRango.toISOString().split('T')[0]
      : '';
    const hoyStr = now.toISOString().split('T')[0];
    if (row.fechaVenceRango && hoyStr > fechaVenceStr) {
      return {
        isValid: false,
        message: `El rango de facturas (${seriesCode}) ha vencido (Fecha límite: ${fechaVenceStr}). Agregue un nuevo rango.`,
      };
    }

    const remaining = this.remainingInvoices(
      row.numeroFin,
      row.ultimoNumeroUsado,
    );
    if (remaining <= 0) {
      return {
        isValid: false,
        message: `Se han agotado los correlativos disponibles en el rango actual de ${seriesCode}.`,
      };
    }

    const trRow = await this.prisma.serieDocumento.findFirst({
      where: {
        codigoSerie: 'TR-ID',
        abierta: true,
        idTienda: gasStationCode,
        codigoPos: posNo,
        fechaInicio: { lte: now },
      },
      orderBy: { numeroLinea: 'asc' },
    });
    if (!trRow) {
      return {
        isValid: false,
        message: `No hay correlativo disponible para POS Transaction ID (TR-ID) en la terminal ${posNo}.`,
      };
    }

    return { isValid: true, message: 'Correlativo válido.' };
  }

  // ===== Turnos =====

  async getShiftDetails(
    storeId: string,
    posNo: string,
    shiftNumber: string,
    employeeName?: string,
  ): Promise<{ shiftDate: Date | string; employeeName: string }> {
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

  // ===== Inserción de venta (reimplementa EIInsertInvoiceFullV1 / EIInsertTicketFullV1) =====

  async executeInvoiceInsert(
    params: InvoiceInsertParams,
  ): Promise<InvoiceInsertResultRow[]> {
    const gasStationCode = padStoreId(params.storeId);
    const seriesCode = params.isTicket ? 'TK-HN' : 'FV-HN';
    const now = new Date();

    const result = await this.prisma.$transaction(
      async (tx) => {
        const invSeries = await lockSeriesForUpdate(
          tx,
          seriesCode,
          gasStationCode,
          params.posNo,
          now,
          true,
        );

        if (!invSeries || !invSeries.ultimoNumeroUsado) {
          throw new Error(
            `No se encontró un rango válido (${seriesCode}) para facturar.`,
          );
        }

        const invoiceNo = nextInvoiceNumber(invSeries.ultimoNumeroUsado);
        const cai = invSeries.cai;
        const startingNo = invSeries.numeroInicio;
        const endingNo = invSeries.numeroFin;
        const fechaVence = invSeries.fechaVenceRango;

        const trSeries = await lockSeriesForUpdate(
          tx,
          'TR-ID',
          gasStationCode,
          params.posNo,
          now,
          false,
        );
        if (!trSeries || !trSeries.ultimoNumeroUsado) {
          throw new Error('No se pudo obtener el número de transacción POS.');
        }
        const posTransactionId = nextTrId(trSeries.ultimoNumeroUsado);

        const emisor = 'PRISMA';
        const tipoDocumento = params.isCredit ? 2 : 1;
        const billingType = params.isCredit ? '0' : '1';
        const lineVat = (params.lines || []).reduce(
          (acc, l) => acc + (Number(l.vatAmount) || 0),
          0,
        );

        await tx.venta.create({
          data: {
            numeroEmisor: emisor,
            idTransaccionPos: posTransactionId,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
            tipoDocumento,
            numeroDocumento: invoiceNo,
            codigoCliente: params.customerNo,
            fechaHoraVenta: now,
            monto: params.total,
            rtnCliente: params.customerRtn,
            nombreCliente: params.customerName,
            tipoFacturacion: billingType === '1' ? 1 : 0,
            comentario: params.comment,
            subtotal: params.total - lineVat,
            kilometraje: params.km,
            orden: params.orden,
            placaOrden: params.placa,
            chofer: params.chofer,
            cambio: 0,
          },
        });

        for (const l of params.lines || []) {
          await tx.lineaVenta.create({
            data: {
              numeroEmisor: emisor,
              idTransaccionPos: posTransactionId,
              numeroLineaDocumento: l.lineNo || 0,
              idTienda: gasStationCode,
              codigoPos: params.posNo,
              tipoDocumento,
              numeroDocumento: invoiceNo,
              tipoVenta: 0,
              numeroVenta: l.itemCode || '',
              descripcion: l.description,
              cantidad: l.quantity ?? 0,
              precioUnitarioConIsv: l.unitPrice ?? 0,
              montoDescuentoUnitario: 0,
              descuento: l.discount ?? 0,
              montoDescuentoLinea: l.discount ?? 0,
              isv: l.vatPercent ?? 0,
              montoIsv: l.vatAmount ?? 0,
              montoConIsv: l.amountIncludingVAT ?? 0,
              numeroBomba: l.pumpNo || '',
              posicionBomba: l.pumpPositionNo || '',
              numeroTanque: l.tankNo || '',
              horaOperacion: now,
              codigoCategoria: l.itemCategoryCode || '',
              bonificado: false,
              devuelto: false,
              generaAsientoBomba: l.genPumpLedgEntry === 1,
              grupoIsv: l.vatProdPostingGroup || '',
              idDespachador: 0,
              idVenta: l.saleId ? String(l.saleId) : null,
              montoGravado: l.amountIncludingVAT ?? 0,
            },
          });
        }

        for (const p of params.payments || []) {
          await tx.pagoVenta.create({
            data: {
              numeroLineaPago: p.chargeLineNo || 0,
              idTransaccionPos: posTransactionId,
              idTienda: gasStationCode,
              codigoPos: params.posNo,
              codigoMetodoPago: String(p.code ?? ''),
              monto: p.amount ?? 0,
              numeroTarjeta: p.reference || '',
              descripcion: p.description || '',
              datosAdicionales: '',
              idDespachador: 0,
              tasaCambio: 1,
              montoIngresado: p.amount ?? 0,
              esTicket: params.isTicket,
            },
          });
        }

        await tx.registroTransaccion.create({
          data: {
            idTransaccionPos: posTransactionId,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
            fechaTurno: params.shiftDate ? new Date(params.shiftDate) : now,
            numeroTurno: String(params.shiftNumber),
            tipoTransaccion: params.isTicket ? 2 : 1,
            fechaHoraTransaccion: now,
            nombreEmpleado: params.employeeName,
            estado: false,
          },
        });

        // Actualizar series
        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: seriesCode,
            numeroLinea: invSeries.numeroLinea,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
          },
          data: { ultimoNumeroUsado: invoiceNo, ultimaFechaUsada: now },
        });
        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: 'TR-ID',
            numeroLinea: trSeries.numeroLinea,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
          },
          data: { ultimoNumeroUsado: posTransactionId, ultimaFechaUsada: now },
        });

        return {
          invoiceNo,
          posTransactionId,
          cai,
          startingNo,
          endingNo,
          fechaVence,
        };
      },
      { isolationLevel: 'ReadCommitted' },
    );

    return [
      {
        NextInvoiceOfNextInvoice: result.invoiceNo,
        NextPosTransactionIDNumber: result.posTransactionId,
        CAIOfNextInvoice: result.cai,
        StartingNoOfNextInvoice: result.startingNo,
        EndingNoOfNextInvoice: result.endingNo,
        FechaVenceRangoOfNextInvoice: result.fechaVence,
      },
    ];
  }

  // ===== Nota de crédito =====

  async executeCreditNote(
    params: CreditNoteParams,
  ): Promise<{ nextPosTransactionId: string; finalInvoiceNo: string }> {
    const gasStationCode = padStoreId(params.storeId);
    const now = new Date();

    const { invoiceNo, posTransactionId } = await this.prisma.$transaction(
      async (tx) => {
        const ncSeries = await lockSeriesForUpdate(
          tx,
          'NC-HN',
          gasStationCode,
          params.posNo,
          now,
          true,
        );
        if (!ncSeries || !ncSeries.ultimoNumeroUsado) {
          throw new Error(
            'No se encontró un rango válido para Notas de Crédito.',
          );
        }
        const invoiceNo = nextInvoiceNumber(ncSeries.ultimoNumeroUsado);

        const trSeries = await lockSeriesForUpdate(
          tx,
          'TR-ID',
          gasStationCode,
          params.posNo,
          now,
          false,
        );
        if (!trSeries || !trSeries.ultimoNumeroUsado) {
          throw new Error('No se pudo obtener el número de transacción POS.');
        }
        const posTransactionId = nextTrId(trSeries.ultimoNumeroUsado);

        await tx.venta.create({
          data: {
            numeroEmisor: 'PRISMA',
            idTransaccionPos: posTransactionId,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
            tipoDocumento: 3,
            numeroDocumento: invoiceNo,
            codigoCliente: params.customerNo || '',
            fechaHoraVenta: now,
            monto: params.amount,
            documentoRelacionado: params.invoiceNo,
            codigoVendedor: params.employeeName,
            rtnCliente: params.customerRtn,
            nombreCliente: params.customerName,
            tipoFacturacion: params.billingType
              ? parseInt(params.billingType, 10) || 0
              : 0,
            comentario: JSON.stringify({ motive: params.reason }),
            subtotal: params.subTotal,
            kilometraje: params.km,
            orden: params.orden,
            placaOrden: params.placa,
            chofer: params.chofer,
            cambio: params.cambio ?? 0,
          },
        });

        await tx.registroTransaccion.create({
          data: {
            idTransaccionPos: posTransactionId,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
            fechaTurno: params.shiftStarting
              ? new Date(params.shiftStarting)
              : now,
            numeroTurno: String(params.shiftNumber),
            tipoTransaccion: 3,
            fechaHoraTransaccion: now,
            nombreEmpleado: params.employeeName,
            estado: false,
          },
        });

        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: 'NC-HN',
            numeroLinea: ncSeries.numeroLinea,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
          },
          data: { ultimoNumeroUsado: invoiceNo, ultimaFechaUsada: now },
        });
        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: 'TR-ID',
            numeroLinea: trSeries.numeroLinea,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
          },
          data: { ultimoNumeroUsado: posTransactionId, ultimaFechaUsada: now },
        });

        return { invoiceNo, posTransactionId };
      },
      { isolationLevel: 'ReadCommitted' },
    );

    return {
      nextPosTransactionId: posTransactionId,
      finalInvoiceNo: invoiceNo,
    };
  }

  async insertSalesLine(params: SalesLineParams): Promise<void> {
    const gasStationCode = padStoreId(params.storeId);
    const row = params.row;
    await this.prisma.lineaVenta.create({
      data: {
        numeroEmisor: 'PRISMA',
        idTransaccionPos: params.nextPosTransactionId,
        numeroLineaDocumento: params.lineNumber,
        idTienda: gasStationCode,
        codigoPos: params.posNo,
        tipoDocumento: 3,
        numeroDocumento: params.finalInvoiceNo,
        tipoVenta: 0,
        numeroVenta: row['POS Sales No_'] || '',
        descripcion: row['Description'],
        cantidad: -(Number(row['Quantity']) || 0),
        precioUnitarioConIsv: Number(row['Unit Price Incl_ VAT']) || 0,
        montoDescuentoUnitario: Number(row['Unit Discount Amount']) || 0,
        descuento: Number(row['Discount _']) || 0,
        montoDescuentoLinea: -(Number(row['Line Discount Amount']) || 0),
        isv: Number(row['VAT _']) || 0,
        montoIsv: -(Number(row['VAT_Amount']) || 0),
        montoConIsv: -(Number(row['Amount Including VAT']) || 0),
        numeroBomba: row['Pump No_'] || '',
        posicionBomba: row['Pump Position No_'] || '',
        numeroTanque: row['Tank No_'] || '',
        horaOperacion: new Date(),
        codigoCategoria: row['Item Category Code'] || '',
        bonificado: false,
        devuelto: false,
        generaAsientoBomba: Number(row['Gen_ Pump Ledg_ Entry']) === 1,
        grupoIsv: row['VAT Prod_ Posting Group'] || '',
        idTransaccionOrigen: params.sourceTransactionId,
        documentoOrigen: params.sourceInvoiceNo,
        lineaDocumentoOrigen: 0,
        idDespachador: 0,
        idVenta: row['SaleID'] ? String(row['SaleID']) : null,
      },
    });
  }

  async insertPaymentMethod(params: PaymentMethodParams): Promise<void> {
    const gasStationCode = padStoreId(params.storeId);
    const row = params.row;
    await this.prisma.pagoVenta.create({
      data: {
        numeroLineaPago: params.chargeLineNo,
        idTransaccionPos: params.nextPosTransactionId,
        idTienda: gasStationCode,
        codigoPos: params.posNo,
        codigoMetodoPago: String(row['Charge Method Code'] ?? ''),
        monto: -(Number(row['Amount']) || 0),
        numeroTarjeta: '',
        descripcion: row['Description'] || '',
        datosAdicionales:
          row['Datos Adicionales'] || row['AdditionalData'] || '',
        idDespachador: 0,
        tasaCambio: Number(row['TasaCambio']) || 1,
        montoIngresado: -(Number(row['MontoIngresado']) || 0),
        esTicket: Number(row['EsTicket']) === 1,
      },
    });
  }

  async insertLealTransactions(params: LealTransactionParams[]): Promise<void> {
    if (params.length === 0) return;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const p of params) {
            await tx.ventaLeal.create({
              data: {
                idTransaccionPos: p.posTransactionId,
                idTransaccionLeal: p.idTransaccionLeal,
                puntos: p.puntos,
                puntosActivos: p.puntosActivos,
                tipo: p.tipo,
                dni: p.dni,
                nombre: p.nombre,
                idAleatorio: p.idAleatorio ? BigInt(p.idAleatorio) : null,
              },
            });
          }
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (e) {
      console.error('Failed to insert Leal transactions locally', e);
    }
  }

  // ===== Lecturas / consultas =====

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

  async getInvoiceSorteos(transactionId: string): Promise<SorteoRow[]> {
    try {
      const rows = await this.prisma.ventaSorteo.findMany({
        where: { idTransaccionPos: transactionId },
      });
      const sorteoIds = rows.map((r) => r.idSorteo).filter((id) => id != null);
      const sorteos = sorteoIds.length
        ? await this.prisma.sorteo.findMany({
            where: { id: { in: sorteoIds } },
          })
        : [];
      const sorteoMap = new Map(sorteos.map((s) => [s.id, s]));
      return rows.map((r) => ({
        sorteoId: r.idSorteo,
        nombre:
          r.idSorteo != null ? sorteoMap.get(r.idSorteo)?.nombre : undefined,
        textoTicket:
          r.idSorteo != null
            ? sorteoMap.get(r.idSorteo)?.textoTicket
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
    try {
      const rows = await this.prisma.motivo.findMany();
      return rows.map((r) => ({ Id_motivo: r.id, motivo: r.motivo }));
    } catch {
      return [];
    }
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
    const [lealRows, sorteoRows] = await Promise.all([
      this.prisma.ventaLeal.findMany({
        where: { idTransaccionPos: { in: ids } },
        select: { idTransaccionPos: true },
      }),
      this.prisma.ventaSorteo.findMany({
        where: { idTransaccionPos: { in: ids } },
        select: { idTransaccionPos: true },
      }),
    ]);
    const lealSet = new Set(lealRows.map((r) => r.idTransaccionPos));
    const sorteoSet = new Set(sorteoRows.map((r) => r.idTransaccionPos));

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
      TieneSorteo: sorteoSet.has(r.idTransaccionPos),
      'Customer Name 2': r.nombreCliente2,
      Address: r.direccionCliente,
      'Address 2': r.direccionCliente2,
      'Postal Code': r.codigoPostalCliente,
      City: r.ciudadCliente,
      Municipality: r.municipioCliente,
      'Country Code': r.codigoPaisCliente,
      'Billing Type': r.tipoFacturacion,
      'E-mail': r.correoCliente,
      Comment: r.comentario,
      Plate: r.placa,
      Mileage: r.kilometraje,
      Order: r.orden,
      'Order Plate': r.placaOrden,
      Driver: r.chofer,
      Change: r.cambio,
      Subtotal: r.subtotal,
      'Customer Card No_': r.numeroTarjetaCliente,
      'Points Card No_': r.numeroTarjetaPuntos,
      'Related Document': r.documentoRelacionado,
      'Salesperson Code': r.codigoVendedor,
      'POS Code': r.codigoPos,
      'Emitter No_': r.numeroEmisor,
      'BC ID': r.bcId,
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

  async creditNote(
    invoiceNo: string,
    reason: string,
  ): Promise<{ success: boolean }> {
    const venta = await this.prisma.venta.findFirst({
      where: { numeroDocumento: invoiceNo },
    });
    if (!venta) {
      throw new Error(`No se encontró la factura ${invoiceNo}.`);
    }

    const transaction = await this.prisma.registroTransaccion.findFirst({
      where: { idTransaccionPos: venta.idTransaccionPos },
    });

    const { nextPosTransactionId, finalInvoiceNo } =
      await this.executeCreditNote({
        storeId: venta.idTienda || '',
        posNo: venta.codigoPos || '',
        employeeName: '',
        shiftStarting: transaction?.fechaTurno ?? new Date(),
        shiftNumber: transaction?.numeroTurno ?? '',
        customerNo: venta.codigoCliente || '',
        customerName: venta.nombreCliente || '',
        customerRtn: venta.rtnCliente || '',
        amount: Number(venta.monto || 0) * -1,
        subTotal: Number(venta.subtotal || 0) * -1,
        billingType:
          venta.tipoFacturacion != null ? String(venta.tipoFacturacion) : '1',
        invoiceNo,
        transactionId: venta.idTransaccionPos,
        reason,
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        cambio: 0,
      });

    const lines = (await this.getInvoiceLines(
      venta.idTransaccionPos,
    )) as InvoiceLineRow[];
    let lineNumber = 0;
    for (const row of lines) {
      lineNumber += 10;
      await this.insertSalesLine({
        nextPosTransactionId,
        storeId: venta.idTienda || '',
        posNo: venta.codigoPos || '',
        finalInvoiceNo,
        lineNumber,
        row,
        sourceTransactionId: venta.idTransaccionPos,
        sourceInvoiceNo: invoiceNo,
      });
    }

    const charges = (await this.getInvoicePayments(
      venta.idTransaccionPos,
    )) as PaymentMethodRow[];
    let chargeLineNo = 0;
    for (const row of charges) {
      chargeLineNo += 10;
      await this.insertPaymentMethod({
        nextPosTransactionId,
        storeId: venta.idTienda || '',
        posNo: venta.codigoPos || '',
        chargeLineNo,
        row,
      });
    }

    return { success: true };
  }
}

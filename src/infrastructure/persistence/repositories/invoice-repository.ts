import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '../../../../src/generated/prisma/client';
import { SERIES, TIPO_DOCUMENTO, TIPO_TRANSACCION } from '../../../domain/constants/business.constants';
import type { Turno } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { lockSeriesForUpdate } from '../series-lock';
import {
  DiscountService,
  BestRuleResult,
} from '../../../domain/services/discount.service';
import type { DiscountRule } from '../../../domain/entities/product.entity';
import type { InvoiceQueryRepository } from '../../../domain/ports/out/invoice-query-repository.interface';
import {
  InvoiceRepository,
  InvoiceInsertParams,
  CreditNoteParams,
  SalesLineParams,
  PaymentMethodParams,
  LealTransactionParams,
  InvoiceInsertResultRow,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly discountService: DiscountService = new DiscountService(),
    @Optional() @Inject('InvoiceQueryRepository')
    private readonly queryRepo?: InvoiceQueryRepository,
  ) {}

  private async evaluateLineDiscount(

    tx: Prisma.TransactionClient,
    l: {
      itemCode?: string;
      itemCategoryCode?: string;
      quantity?: number;
      unitPrice?: number;
      vatProdPostingGroup?: string;
    },
    customerCode: string,
  ): Promise<BestRuleResult | null> {
    const now = new Date();
    const rules = await tx.reglaDescuento.findMany({
      where: {
        activo: true,
        AND: [
          { OR: [{ fechaInicio: null }, { fechaInicio: { lte: now } }] },
          { OR: [{ fechaFin: null }, { fechaFin: { gte: now } }] },
          { OR: [{ codigoCliente: customerCode }, { codigoCliente: null }] },
          {
            OR: [
              { codigoProducto: l.itemCode ?? '' },
              { codigoProducto: null },
            ],
          },
          {
            OR: [
              { codigoCategoria: l.itemCategoryCode ?? '' },
              { codigoCategoria: null },
            ],
          },
        ],
      },
    });
    const ruleDtos: DiscountRule[] = rules.map((r) => ({
      id: r.id,
      codigoCliente: r.codigoCliente ?? undefined,
      codigoProducto: r.codigoProducto ?? undefined,
      codigoCategoria: r.codigoCategoria ?? undefined,
      cantidadMinima:
        r.cantidadMinima != null ? Number(r.cantidadMinima) : undefined,
      tipoBeneficio: r.tipoBeneficio,
      valor: Number(r.valor),
      unidadVolumen: r.unidadVolumen ?? undefined,
      prioridad: r.prioridad,
      acumulable: r.acumulable ?? false,
    }));
    return this.discountService.evaluateBestRule(
      ruleDtos,
      l.quantity ?? 0,
      l.unitPrice ?? 0,
      l.vatProdPostingGroup ?? '',
    );
  }

  async executeInvoiceInsert(

    params: InvoiceInsertParams,
  ): Promise<InvoiceInsertResultRow[]> {
    const gasStationCode = padStoreId(params.storeId);
    const seriesCode = params.isTicket ? SERIES.TICKET : SERIES.FACTURA;
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

        const emisor =
          (
            await tx.tienda.findFirst({
              where: { idTienda: gasStationCode },
              select: { emisor: true },
            })
          )?.emisor || 'PRISMA';
        const tipoDocumento = params.isTicket
          ? TIPO_DOCUMENTO.TICKET
          : params.isCredit
            ? TIPO_DOCUMENTO.CREDITO
            : TIPO_DOCUMENTO.FACTURA;
        const billingType = params.isCredit ? '0' : '1';
        const lineSubtotal = (params.lines || []).reduce(
          (acc, l) => acc + (Number(l.montoGravado) || 0),
          0,
        );
        const lineTotal = (params.lines || []).reduce(
          (acc, l) => acc + (Number(l.amountIncludingVAT) || 0),
          0,
        );
        const montoPagado = (params.payments || []).reduce((acc, p) => {
          const esUsd = p.moneda === 'USD';
          const tasa = p.tasaCambio && p.tasaCambio > 0 ? p.tasaCambio : 1;
          const hnl = esUsd
            ? Math.round((Number(p.amount) || 0) * tasa * 100) / 100
            : Number(p.amount) || 0;
          return acc + hnl;
        }, 0);
        const cambio = Math.max(
          0,
          Math.round((montoPagado - lineTotal) * 100) / 100,
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
            monto: lineTotal,
            rtnCliente: params.customerRtn,
            nombreCliente: params.customerName,
            tipoFacturacion: billingType === '1' ? 1 : 0,
            comentario: params.comment,
            subtotal: lineSubtotal,
            kilometraje: params.km,
            orden: params.orden,
            placaOrden: params.placa,
            chofer: params.chofer,
            cambio,
            numeroLinea: (params.lines || []).length,
            cai: invSeries.cai,
            rangoDesde: invSeries.numeroInicio,
            rangoHasta: invSeries.numeroFin,
            fechaVenceRango: invSeries.fechaVenceRango,
            idTurno: params.shiftId ?? null,
            numeroTurno: String(params.shiftNumber),
          },
        });

        for (const l of params.lines || []) {
          const winner = await this.evaluateLineDiscount(
            tx,
            l,
            params.customerNo,
          );
          const discountAmount = winner
            ? winner.benefit
            : (l.discount ?? 0);
          const unitDiscount = winner
            ? winner.benefit / (l.quantity || 1)
            : 0;
          await tx.lineaVenta.create({
            data: {
              numeroEmisor: emisor,
              idTransaccionPos: posTransactionId,
              numeroLineaDocumento: l.lineNo || 0,
              idTienda: gasStationCode,
              codigoPos: params.posNo,
              tipoDocumento,
              numeroDocumento: invoiceNo,
              numeroVenta: l.itemCode || '',
              descripcion: l.description,
              cantidad: l.quantity ?? 0,
              precioUnitarioConIsv: l.unitPrice ?? 0,
              montoDescuentoUnitario: unitDiscount,
              descuento: discountAmount,
              montoDescuentoLinea: discountAmount,
              isv: l.vatPercent ?? 0,
              montoIsv: l.vatAmount ?? 0,
              montoConIsv: l.amountIncludingVAT ?? 0,
              numeroBomba: l.pumpNo || '',
              posicionBomba: l.pumpPositionNo || '',
              numeroTanque: l.tankNo || '',
              unidadMedida: l.unidadMedida ?? null,
              turnoControlador: l.turnoControlador ?? null,
              horaOperacion: now,
              codigoCategoria: l.itemCategoryCode || '',
              bonificado: false,
              devuelto: false,
              generaAsientoBomba: l.genPumpLedgEntry === 1,
              grupoIsv: l.vatProdPostingGroup || '',
              idDespachador: 0,
              idVenta: l.saleId ? String(l.saleId) : null,
              montoGravado: l.montoGravado ?? 0,
            },
          });
          if (winner) {
            const rulesToRecord =
              winner.appliedRules && winner.appliedRules.length > 0
                ? winner.appliedRules
                : [{ rule: winner.rule, benefit: winner.benefit }];

            for (const applied of rulesToRecord) {
              if (applied.benefit > 0) {
                await tx.lineaVentaDescuentoAplicado.create({
                  data: {
                    numeroEmisor: emisor,
                    numeroLineaDocumento: l.lineNo || 0,
                    idTransaccionPos: posTransactionId,
                    idRegla: applied.rule.id,
                    tipoBeneficio: applied.rule.tipoBeneficio,
                    valor: applied.rule.valor,
                    montoAplicado: applied.benefit,
                  },
                });
              }
            }
          }
        }

        for (const p of params.payments || []) {
          const esUsd = p.moneda === 'USD';
          const tasa = p.tasaCambio && p.tasaCambio > 0 ? p.tasaCambio : 1;
          const montoHnl = esUsd ? Math.round(p.amount * tasa * 100) / 100 : (p.amount ?? 0);
          await tx.pagoVenta.create({
            data: {
              numeroLineaPago: p.chargeLineNo || 0,
              idTransaccionPos: posTransactionId,
              idTienda: gasStationCode,
              codigoPos: params.posNo,
              codigoMetodoPago: String(p.code ?? ''),
              monto: montoHnl,
              numeroTarjeta: p.reference || '',
              descripcion: p.description || '',
              datosAdicionales: '',
              idDespachador: 0,
              tasaCambio: esUsd ? tasa : 1,
              montoIngresado: esUsd ? (p.montoIngresado ?? p.amount) : (p.amount ?? 0),
              esTicket: params.isTicket,
            },
          });
        }

        const campanaTickets = params.onCommit
          ? ((await params.onCommit(
              tx,
              posTransactionId,
            )) as unknown as import('../../../application/services/campanas.service').CampanaTicket[])
          : [];

        await tx.registroTransaccion.create({
          data: {
            idTransaccionPos: posTransactionId,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
            fechaTurno: params.shiftDate ? new Date(params.shiftDate) : now,
            numeroTurno: String(params.shiftNumber),
            idTurno: params.shiftId ?? null,
            tipoTransaccion: params.isTicket ? TIPO_TRANSACCION.TICKET : TIPO_TRANSACCION.FACTURA,
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
            codigoSerie: SERIES.TRANSACCION,
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
          campanaTickets,
          seriesRemaining: invSeries.remaining,
          seriesRemainingDays: invSeries.remainingDays,
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
        CampanaTickets: result.campanaTickets,
        SeriesRemaining: result.seriesRemaining,
        SeriesRemainingDays: result.seriesRemainingDays,
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
            tipoDocumento: TIPO_DOCUMENTO.NOTA_CREDITO,
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
            numeroLinea: params.numeroLinea,
            cai: ncSeries.cai,
            rangoDesde: ncSeries.numeroInicio,
            rangoHasta: ncSeries.numeroFin,
            fechaVenceRango: ncSeries.fechaVenceRango,
            idTurno: params.shiftId ?? null,
            numeroTurno: String(params.shiftNumber),
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
            idTurno: params.shiftId ?? null,
            tipoTransaccion: TIPO_TRANSACCION.NOTA_CREDITO,
            fechaHoraTransaccion: now,
            nombreEmpleado: params.employeeName,
            estado: false,
          },
        });

        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: SERIES.NOTA_CREDITO,
            numeroLinea: ncSeries.numeroLinea,
            idTienda: gasStationCode,
            codigoPos: params.posNo,
          },
          data: { ultimoNumeroUsado: invoiceNo, ultimaFechaUsada: now },
        });
        await tx.serieDocumento.updateMany({
          where: {
            codigoSerie: SERIES.TRANSACCION,
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
        tipoDocumento: TIPO_DOCUMENTO.NOTA_CREDITO,
        numeroDocumento: params.finalInvoiceNo,
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
        numeroLinea: venta.numeroLinea,
      });

    if (!this.queryRepo) throw new Error('InvoiceQueryRepository no disponible');
    const lines = (await this.queryRepo.getInvoiceLines(
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

    const charges = (await this.queryRepo.getInvoicePayments(
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

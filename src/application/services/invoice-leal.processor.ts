import { Inject, Injectable } from '@nestjs/common';
import { LEAL_EXCLUDED_KEYWORDS } from '../../domain/constants/business.constants';
import type { CreateInvoiceInput } from '../../domain/entities/invoice.entity';
import type {
  LealRepository,
  LealTransactionResult,
} from '../../domain/ports/out/leal-repository.interface';
import type {
  InvoiceRepository,
  InvoiceLineRow,
  LealTransactionParams,
} from '../../domain/ports/out/invoice-repository.interface';
import type { InvoiceQueryRepository } from '../../domain/ports/out/invoice-query-repository.interface';

export interface LealOperationResult {
  puntos: number;
  puntosActivos: number;
  idTransaccionLeal: string;
}

@Injectable()
export class InvoiceLealProcessor {
  constructor(
    @Inject('LealRepository') private readonly lealRepo: LealRepository,
    @Inject('InvoiceRepository')
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('InvoiceQueryRepository')
    private readonly invoiceQueryRepo: InvoiceQueryRepository,
  ) {}

  async processRedemptions(
    dto: CreateInvoiceInput,
    predictedInvoiceNo: string,
  ): Promise<{ redemptions: LealOperationResult[]; message: string }> {
    const redemptions: LealOperationResult[] = [];
    let message = '';

    const lealPayments = dto.payments.filter((p) => p.lealData);
    for (const lealPay of lealPayments) {
      if (!lealPay.lealData) continue;
      // factura = aleatorioRed (único), nota = factura real (solo como referencia)
      const result = (await this.lealRepo.redeemPoints({
        customerId: lealPay.lealData.uid,
        points: lealPay.lealData.puntos || 0,
        invoiceNo: dto.lealIdAleatorioRed ?? predictedInvoiceNo,
        token: '',
        idPremio: lealPay.lealData.idPremio,
        otp: lealPay.lealData.otp,
        nota: `Redencion Prisma ${predictedInvoiceNo}`,
      })) as LealTransactionResult;
      const puntosActivos =
        result.puntos_activos || result.data?.puntos_activos || 0;
      redemptions.push({
        puntos: lealPay.lealData.puntos || 0,
        puntosActivos,
        idTransaccionLeal:
          result.id_transaccion || result.data?.id_transaccion || '',
      });
      message += `Puntos Redimidos: ${lealPay.lealData.puntos || 0} | Puntos Activos: ${puntosActivos}\n`;
    }

    return { redemptions, message };
  }

  async processAccumulation(
    dto: CreateInvoiceInput,
    predictedInvoiceNo: string,
  ): Promise<{ result: LealOperationResult | null; message: string }> {
    let message = '';
    if (!dto.lealIdAleatorioAcum || !dto.lealCustomerUid) {
      return { result: null, message };
    }

    const excludedKeywords: readonly string[] = LEAL_EXCLUDED_KEYWORDS;
    const eligiblePayments = dto.payments.filter(
      (p) =>
        !excludedKeywords.some((kw) =>
          (p.method || '').toUpperCase().includes(kw),
        ),
    );
    const totalAcum = eligiblePayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );
    const formaPago = eligiblePayments.map((p) => p.method).join(', ');

    const lealItems = dto.items.map((item) => ({
      codigo: item.code,
      descripcion: item.description,
      cantidad: item.qty,
      precio_unitario: item.price,
      subtotal: item.total - item.tax,
      impuesto: item.tax,
      descuento: item.discount,
      total: item.total,
    }));

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const totalesData = {
      SubTotal: Math.round((dto.total - dto.tax) * 100) / 100,
      ImpuestoTotal: Math.round(dto.tax * 100) / 100,
      DescuentoTotal: Math.round(dto.discount * 100) / 100,
      FormaPago: formaPago,
      TotalPersonas: 1,
      Fecha: now,
      FechaApertura: now,
      FechaCierre: now,
      Items: lealItems,
    };

    try {
      const result = (await this.lealRepo.accumulatePoints({
        customerId: dto.lealCustomerUid,
        invoiceNo: predictedInvoiceNo,
        noFactura: dto.lealIdAleatorioAcum,
        total: totalAcum,
        token: '',
        totales: totalesData,
        pin: dto.lealPin,
      })) as LealTransactionResult;
      if (result) {
        const puntos = result.puntos || result.data?.puntos || 0;
        const puntosActivos =
          result.puntos_activos || result.data?.puntos_activos || 0;
        message += `Puntos Acumulados: ${puntos} | Puntos Activos: ${puntosActivos}\n`;
        return {
          result: {
            puntos,
            puntosActivos,
            idTransaccionLeal:
              result.id_transaccion || result.data?.id_transaccion || '',
          },
          message,
        };
      }
    } catch (lealError: unknown) {
      const errorMessage =
        lealError instanceof Error ? lealError.message : String(lealError);
      console.error(
        '⚠️ Error al acumular puntos en Leal (no bloquea la venta):',
        errorMessage,
      );
      message += `⚠️ No se pudo acumular en Leal: ${errorMessage}\n`;
    }

    return { result: null, message };
  }

  async persistTransactions(
    dto: CreateInvoiceInput,
    posTransactionId: string,
    redemptions: LealOperationResult[],
    accumulationResult: LealOperationResult | null,
  ): Promise<void> {
    const rows = this.buildTransactions(
      dto,
      posTransactionId,
      redemptions,
      accumulationResult,
    );
    await this.invoiceRepo.insertLealTransactions(rows);
  }

  buildTransactions(
    dto: CreateInvoiceInput,
    posTransactionId: string,
    redemptions: LealOperationResult[],
    accumulationResult: LealOperationResult | null,
  ): LealTransactionParams[] {
    const lealData = dto.payments.find((p) => p.lealData)?.lealData;
    const rows: LealTransactionParams[] = [];

    for (const red of redemptions) {
      rows.push({
        posTransactionId,
        idTransaccionLeal: red.idTransaccionLeal,
        puntos: red.puntos,
        puntosActivos: red.puntosActivos,
        tipo: 1,
        dni:
          dto.lealCustomerDni ??
          lealData?.customerDocumentId ??
          lealData?.cedula ??
          lealData?.uid ??
          '',
        nombre: dto.lealCustomerName ?? lealData?.customerName ?? '',
        idAleatorio: dto.lealIdAleatorioRed || null,
      });
    }

    if (accumulationResult) {
      rows.push({
        posTransactionId,
        idTransaccionLeal: accumulationResult.idTransaccionLeal,
        puntos: accumulationResult.puntos,
        puntosActivos: accumulationResult.puntosActivos,
        tipo: 0,
        dni:
          dto.lealCustomerDni ??
          lealData?.customerDocumentId ??
          lealData?.cedula ??
          dto.lealCustomerUid ??
          '',
        nombre: dto.lealCustomerName ?? lealData?.customerName ?? '',
        idAleatorio: dto.lealIdAleatorioAcum || null,
      });
    }

    return rows;
  }

  /**
   * Compensación: revierte operaciones Leal (redención/acumulación) que ya se
   * procesaron externamente pero cuyo insert de factura falló. Best-effort.
   */
  async compensate(opts: {
    redemptions: LealOperationResult[];
    accumulationResult: LealOperationResult | null;
    lealIdAleatorioRed?: string | null;
    lealIdAleatorioAcum?: string | null;
    predictedInvoiceNo: string;
  }): Promise<void> {
    for (const red of opts.redemptions) {
      if (!red.idTransaccionLeal) continue;
      try {
        await this.lealRepo.reverseTransaction(
          red.idTransaccionLeal,
          opts.lealIdAleatorioRed ?? opts.predictedInvoiceNo,
          '',
        );
      } catch {
        console.warn(
          `[Leal] Error revirtiendo redención ${red.idTransaccionLeal}:`,
        );
      }
    }
    const acc = opts.accumulationResult;
    if (acc?.idTransaccionLeal) {
      try {
        await this.lealRepo.reverseTransaction(
          acc.idTransaccionLeal,
          opts.lealIdAleatorioAcum ?? '',
          '',
        );
      } catch {
        console.warn(
          `[Leal] Error revirtiendo acumulación ${acc.idTransaccionLeal}:`,
        );
      }
    }
  }

  async reverseForCreditNote(transactionId: string): Promise<void> {
    const lines = (await this.invoiceQueryRepo.getInvoiceLines(
      transactionId,
    )) as InvoiceLineRow[];
    for (const lt of lines) {
      if (!lt.IDAleatorio) continue;
      try {
        await this.lealRepo.reverseTransaction(
          lt.IdTransaccionLeal?.toString() || '',
          lt.IDAleatorio.toString(),
          '',
        );
      } catch {
        console.warn('Error anulando en Leal:');
      }
    }
  }
}

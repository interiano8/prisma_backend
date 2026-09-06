import type { CreateInvoiceInput } from '../../domain/entities/invoice.entity';
import type {
  InvoicePaymentItem,
  InvoiceInsertResultRow,
} from '../../domain/ports/out/invoice-repository.interface';

export interface ExtractedInvoiceResult {
  invoiceNo: string;
  posTransactionId: string | null;
  cai: string | null;
  startingNo: string | null;
  endingNo: string | null;
  fechaVence: string | null;
  campanaTickets: unknown[];
  seriesRemaining?: number;
  seriesRemainingDays?: number;
}

/**
 * Responsabilidad única: mapear el DTO de venta a pagos persistibles y
 * extraer el resultado del insert de factura. Sin dependencias externas.
 */
export class InvoiceResultMapper {
  buildInvoicePayments(dto: CreateInvoiceInput): InvoicePaymentItem[] {
    const payments: InvoicePaymentItem[] = [];
    let chargeLineNo = 10;

    for (const payment of dto.payments) {
      let desc = 'EFECTIVO';
      const upper = payment.method.toUpperCase();
      if (
        upper.includes('TARJETA') ||
        upper.includes('BAC') ||
        upper.includes('BANPRO')
      )
        desc = 'TARJETA';
      else if (upper.includes('LEAL')) desc = 'LEAL';
      else if (
        upper.includes('CREDITO') ||
        upper.includes('CRÉDITO') ||
        upper.includes('CRED')
      )
        desc = 'CREDITO';

      const paymentRef =
        desc === 'LEAL' ? '' : (payment.reference || '').substring(0, 20);
      payments.push({
        chargeLineNo,
        code: payment.code,
        amount: payment.amount,
        reference: paymentRef,
        description: desc,
        moneda: payment.moneda,
        tasaCambio: payment.tasaCambio,
        montoIngresado: payment.montoIngresado,
      });
      chargeLineNo += 10;
    }

    return payments;
  }

  extractInvoiceResult(
    executeResult: InvoiceInsertResultRow[],
    dto: CreateInvoiceInput,
  ): ExtractedInvoiceResult {
    const fallbackInvoiceNo = `FAC-${dto.storeId}-${dto.posNo}-${Date.now().toString().slice(-6)}`;
    const result: ExtractedInvoiceResult = {
      invoiceNo: fallbackInvoiceNo,
      posTransactionId: null,
      cai: null,
      startingNo: null,
      endingNo: null,
      fechaVence: null,
      campanaTickets: [],
    };

    if (!executeResult || executeResult.length === 0) {
      return result;
    }

    const getSingle = (
      val: string | Date | null | undefined,
    ): string | null => {
      if (val === null || val === undefined) return null;
      if (Array.isArray(val))
        return val.length === 0
          ? null
          : getSingle(val[0] as string | Date | null | undefined);
      return String(val);
    };
    const flat = executeResult.flat(Infinity);
    const row = flat.find(
      (r) =>
        r &&
        (r.NextInvoiceOfNextInvoice ||
          r.NextPosTransactionIDNumber ||
          r.CAIOfNextInvoice),
    );
    if (row) {
      result.invoiceNo =
        getSingle(row.NextInvoiceOfNextInvoice) || fallbackInvoiceNo;
      result.posTransactionId = getSingle(row.NextPosTransactionIDNumber);
      result.cai = getSingle(row.CAIOfNextInvoice);
      result.startingNo = getSingle(row.StartingNoOfNextInvoice);
      result.endingNo = getSingle(row.EndingNoOfNextInvoice);
      result.fechaVence = getSingle(row.FechaVenceRangoOfNextInvoice);
      result.campanaTickets = (row as any)?.CampanaTickets ?? [];
      result.seriesRemaining = (row as any)?.SeriesRemaining ?? 0;
      result.seriesRemainingDays = (row as any)?.SeriesRemainingDays ?? 0;
    }

    return result;
  }
}
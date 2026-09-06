import { InvoiceItem } from '../entities/invoice-item.entity';

export class InvoicePricingService {
  constructor(
    private readonly tasasPorGrupo: Record<string, number> = {},
  ) {}

  calculateVatAmount(amountIncludingVat: number, vatPercent: number): number {
    return amountIncludingVat - amountIncludingVat / (1 + vatPercent / 100);
  }

  getVatPercent(vatGroup: string): number {
    const cleanGroup = vatGroup.toUpperCase();
    return this.tasasPorGrupo[cleanGroup] ?? 0;
  }

  calculateLineTotal(item: InvoiceItem): number {
    return item.qty * item.price - (item.discount || 0);
  }

  calculateInvoiceTotals(items: InvoiceItem[]): {
    subtotal: number;
    total: number;
    tax: number;
    discount: number;
  } {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    for (const item of items) {
      subtotal += item.qty * item.price;
      discount += item.discount || 0;
      tax += item.tax || 0;
    }

    return {
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax,
    };
  }
}

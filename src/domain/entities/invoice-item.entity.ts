export interface InvoiceItem {
  code: string;
  description: string;
  qty: number;
  price: number;
  tax: number;
  discount: number;
  total: number;
  saleId?: number;
}

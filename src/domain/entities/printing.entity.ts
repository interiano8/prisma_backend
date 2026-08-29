export interface PrintingConfig {
  printerName: string;
  columns: number;
  title: string;
  storeName: string;
  address1: string;
  address2: string;
  address3: string;
  phone: string;
  rtn: string;
  email: string;
}

export interface InvoicePrintData {
  invoiceNo: string;
  cai: string;
  expiryDate: string;
  startingNo: string;
  endingNo: string;
  customerName: string;
  customerRTN: string;
  comment: string;
  paymentMethods: PaymentMethodDetail[];
  lines: InvoiceLinePrintData[];
  total: number;
  totals: InvoiceTotals;
  date: string;
  customerAccount: string;
  km: string;
  orderNo: string;
  licensePlate: string;
  driver: string;
  attendant: string;
  docType: string;
  invoiceType: string;
  terminal: string;
  shift: string;
  originalInvoiceNo?: string;
  originalInvoiceDate?: string;
  lealMessages?: string[];
  raffleMessage?: string;
  raffleCorrelative?: string;
}

export interface InvoiceLinePrintData {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount: number;
  dispenser?: string;
  tank?: string;
  attendant?: string;
}

export interface InvoiceTotals {
  discounts: number;
  exemptAmount: number;
  tax15Amount: number;
  tax18Amount: number;
  tax15: number;
  tax18: number;
  subtotal: number;
  total: number;
  received?: number;
  change?: number;
}

export interface PaymentMethodDetail {
  code: number;
  description: string;
  amount: number;
  exchangeRate?: number;
  amountEntered?: number;
  additionalData?: string;
  summary?: string;
}

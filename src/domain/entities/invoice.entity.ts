import { InvoiceItem } from './invoice-item.entity';

export interface Invoice {
  invoiceNo: string;
  storeId: string;
  posNo: string;
  shiftNumber: string;
  customerNo: string;
  customerName: string;
  customerRtn?: string;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  total: number;
  tax: number;
  discount: number;
  createdAt: string;
}

export interface InvoicePayment {
  method: string;
  amount: number;
  reference?: string;
}

export interface InvoiceItemInput {
  code: string;
  description: string;
  qty: number;
  price: number;
  tax: number;
  discount: number;
  total: number;
  saleId?: number;
  discountPercentage?: number;
}

export interface LealPaymentData {
  uid: string;
  puntos?: number;
  idPremio?: number;
  otp?: string;
  customerDocumentId?: string;
  cedula?: string;
  customerName?: string;
}

export interface InvoicePaymentInput {
  method: string;
  code: string;
  amount: number;
  reference?: string;
  moneda?: string;
  tasaCambio?: number;
  montoIngresado?: number;
  lealData?: LealPaymentData;
}

export interface CreateInvoiceInput {
  storeId: string;
  posNo: string;
  shiftNumber: string;
  customerNo: string;
  customerName: string;
  customerRtn?: string;
  shiftDate?: string;
  employeeName?: string;
  items: InvoiceItemInput[];
  payments: InvoicePaymentInput[];
  total: number;
  tax: number;
  discount: number;
  isTicket?: boolean;
  isCredit?: boolean;
  km?: string;
  orden?: string;
  placa?: string;
  chofer?: string;
  comment?: string;
  lealIdAleatorioAcum?: string;
  lealIdAleatorioRed?: string;
  lealCustomerUid?: string;
  lealCustomerName?: string;
  lealCustomerDni?: string;
  lealPin?: string;
  permitirFacturarSinAcumular?: boolean;
  omitirAcumulacion?: boolean;
}

export interface CreditNoteInput {
  transactionId: string;
  invoiceNo: string;
  reason: string;
  storeId?: string;
  posNo?: string;
  username?: string;
  adminPassword?: string;
}

export interface CreateInvoiceCommand {
  storeId: string;
  posNo: string;
  shiftNumber: string;
  customerNo: string;
  customerName: string;
  customerRtn?: string;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  total: number;
  tax: number;
  discount: number;
}

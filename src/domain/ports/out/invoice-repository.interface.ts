export interface InvoiceLineItem {
  lineNo: number;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountPercentage?: number;
  vatPercent: number;
  vatAmount: number;
  amountIncludingVAT: number;
  montoGravado: number;
  pumpNo: string;
  pumpPositionNo: string;
  tankNo: string;
  unidadMedida?: string | null;
  turnoControlador?: string | null;
  itemCategoryCode: string;
  genPumpLedgEntry: number;
  vatProdPostingGroup: string;
  saleId?: string | number | null;
}

export interface InvoicePaymentItem {
  chargeLineNo: number;
  code: string | number;
  amount: number;
  reference: string;
  description: string;
  moneda?: string;
  tasaCambio?: number;
  montoIngresado?: number;
}

export interface InvoiceInsertParams {
  storeId: string;
  posNo: string;
  employeeName: string;
  shiftDate: Date | string;
  shiftNumber: string;
  shiftId?: string | null;
  customerNo: string;
  customerName: string;
  customerRtn: string;
  total: number;
  tax: number;
  discount: number;
  isTicket: boolean;
  isCredit: boolean;
  creditValidationSource?: string;
  comment: string;
  km: string;
  orden: string;
  placa: string;
  chofer: string;
  lines: InvoiceLineItem[];
  payments: InvoicePaymentItem[];
  onCommit?: (
    tx: import('../../../../src/generated/prisma/client').Prisma.TransactionClient,
    posTransactionId: string,
  ) => Promise<any[] | undefined>;
}

export interface InvoiceInsertResultRow {
  NextInvoiceOfNextInvoice: string;
  NextPosTransactionIDNumber: string;
  CAIOfNextInvoice: string | null;
  StartingNoOfNextInvoice: string | null;
  EndingNoOfNextInvoice: string | null;
  FechaVenceRangoOfNextInvoice: Date | null;
  CampanaTickets?: unknown[];
  SeriesRemaining?: number;
  SeriesRemainingDays?: number;
}

export interface CreditNoteParams {
  storeId: string;
  posNo: string;
  employeeName: string;
  shiftStarting: Date | string;
  shiftNumber: string;
  shiftId?: string | null;
  customerNo: string;
  customerName: string;
  customerRtn: string;
  amount: number;
  subTotal: number;
  billingType: string;
  invoiceNo: string;
  transactionId: string;
  reason: string;
  km: string;
  orden: string;
  placa: string;
  chofer: string;
  cambio: number;
  numeroLinea: number | null;
}

export interface SalesLineRow {
  'POS Sales No_': string | null;
  Description: string | null;
  Quantity: number | null;
  'Unit Price Incl_ VAT': number | null;
  'Unit Discount Amount': number | null;
  'Discount _': number | null;
  'Line Discount Amount': number | null;
  'VAT _': number | null;
  VAT_Amount: number | null;
  'Amount Including VAT': number | null;
  'Pump No_': string | null;
  'Pump Position No_': string | null;
  'Tank No_': string | null;
  'Item Category Code': string | null;
  'Gen_ Pump Ledg_ Entry': number | null;
  'VAT Prod_ Posting Group': string | null;
  SaleID: string | null;
}

export interface InvoiceLineRow extends SalesLineRow {
  IdTransaccionLeal: string | null;
  IDAleatorio: string | null;
}

export interface SalesLineParams {
  storeId: string;
  nextPosTransactionId: string;
  lineNumber: number;
  posNo: string;
  finalInvoiceNo: string;
  sourceTransactionId: string;
  sourceInvoiceNo: string;
  row: SalesLineRow;
}

export interface PaymentMethodRow {
  'Charge Method Code': string | null;
  Amount: number | null;
  MontoIngresado: number | null;
  Description: string | null;
  'Datos Adicionales': string | null;
  AdditionalData?: string | null;
  TasaCambio: number | null;
  EsTicket: number | null;
}

export interface PaymentMethodParams {
  storeId: string;
  nextPosTransactionId: string;
  chargeLineNo: number;
  posNo: string;
  row: PaymentMethodRow;
}

export interface LealTransactionParams {
  posTransactionId: string;
  idTransaccionLeal: string;
  puntos: number;
  puntosActivos: number;
  tipo: number;
  dni: string;
  nombre: string;
  idAleatorio: string | null;
}

export interface SearchInvoicesParams {
  storeId: string;
  avanzado: boolean;
  posNo?: string;
  turno?: string;
  fechaTurno?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  factura?: string;
  customerName?: string;
  employeeName?: string;
  page?: number;
  pageSize?: number;
}

export interface OpenShiftRow {
  'Shift Starting': Date;
  EmployeeName: string | null;
  Shift: string | null;
  'POS Transaction ID': string | null;
}

export interface LealRow {
  Tipo: number | null;
  Puntos: number | null;
  PuntosActivos: number | null;
}

export interface OriginalDocumentRow {
  'POS Sales Doc_ Type': number | null;
  'Customer No_': string | null;
  Amount: number | null;
  'VAT Reg_ No_': string | null;
  'Cust_ Name': string | null;
  'Billing Type': number | null;
  SubTotal: number | null;
  KM: string | null;
  Orden: string | null;
  Placa: string | null;
  Chofer: string | null;
  Cambio: number | null;
}

export interface CampanaRow {
  campanaId: number | null;
  nombre: string | null | undefined;
  textoTicket: string | null | undefined;
  correlativo: string | null;
}

export interface ReasonRow {
  Id_motivo: number;
  motivo: string | null;
}

export interface InvoiceRepository {
  creditNote(invoiceNo: string, reason: string): Promise<{ success: boolean }>;

  executeInvoiceInsert(
    params: InvoiceInsertParams,
  ): Promise<InvoiceInsertResultRow[]>;
  executeCreditNote(
    params: CreditNoteParams,
  ): Promise<{ nextPosTransactionId: string; finalInvoiceNo: string }>;
  insertSalesLine(params: SalesLineParams): Promise<void>;
  insertPaymentMethod(params: PaymentMethodParams): Promise<void>;
  insertLealTransactions(params: LealTransactionParams[]): Promise<void>;
}

import type {
  SearchInvoicesParams,
  LealRow,
  CampanaRow,
  ReasonRow,
  OriginalDocumentRow,
  OpenShiftRow,
} from './invoice-repository.interface';

export interface InvoiceQueryRepository {
  findAll(): Promise<any[]>;
  findByNo(invoiceNo: string): Promise<any>;
  findNextCorrelative(
    storeId: string,
    posNo: string,
  ): Promise<{ invoiceNo: string; posTransactionId: string }>;
  findNextCreditNoteCorrelative(
    storeId: string,
    posNo: string,
  ): Promise<{
    serieCode: string;
    nextInvoice: string;
    remainingInvoices: number;
    remainingDays: number;
  }>;
  getShiftDetails(
    storeId: string,
    posNo: string,
    shiftNumber: string,
    employeeName?: string,
  ): Promise<{ shiftDate: Date | string; employeeName: string; shiftId: string | null }>;
  validateCorrelative(
    storeId: string,
    posNo: string,
    isTicket: boolean,
  ): Promise<{ isValid: boolean; message: string; remaining?: number; remainingDays?: number }>;
  getOriginalDocument(invoiceNo: string, transactionId: string): Promise<any>;
  checkExistingReversion(invoiceNo: string, transactionId: string): Promise<boolean>;
  getOpenShiftForEmployee(
    storeId: string,
    employeeName: string,
  ): Promise<OpenShiftRow | null>;
  getInvoiceLines(transactionId: string): Promise<any[]>;
  getInvoicePayments(transactionId: string): Promise<any[]>;
  getInvoiceLealTransactions(transactionId: string): Promise<LealRow[]>;
  getInvoiceCampanas(transactionId: string): Promise<CampanaRow[]>;
  findStoreConfigField(storeId: string, field: string): Promise<any>;
  getReasons(): Promise<ReasonRow[]>;
  getFidelizacionPaymentCodes?(): Promise<string[]>;
  searchInvoices(
    params: SearchInvoicesParams,
  ): Promise<
    any[] | { total: number; page: number; pageSize: number; data: any[] }
  >;
}
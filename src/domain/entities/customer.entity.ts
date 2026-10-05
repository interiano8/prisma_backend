export interface Customer {
  code: string;
  name: string;
  rtf: string;
  phone: string;
  email: string;
  address: string;
  blocked?: boolean;
  billingType?: number;
  dateUpdate?: string;
  creditLimit?: number;
  creditDays?: number;
  blockOnOverdue?: boolean;
  balance?: number;
  hasOverdueInvoices?: boolean;
}

import {
  PaymentMethod,
  PaymentAllocation,
} from '../../entities/payment-method.entity';

export interface ProcessPaymentRequest {
  storeId: string;
  posNo: string;
  shiftNumber: string;
  customerNo: string;
  customerName: string;
  customerRtn?: string;
  items: unknown[];
  payments: PaymentAllocation[];
  total: number;
  tax: number;
  discount: number;
}

export interface PaymentProcessResult {
  success: boolean;
  invoiceNo: string;
}

export interface PaymentRepository {
  getPaymentMethods(): Promise<PaymentMethod[]>;
  processPayment(data: ProcessPaymentRequest): Promise<PaymentProcessResult>;
}

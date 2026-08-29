import { PaymentMethod } from '../../entities/payment-method.entity';
import type {
  ProcessPaymentRequest,
  PaymentProcessResult,
} from '../../ports/out/payment-repository.interface';

export interface PaymentUseCase {
  getPaymentMethods(): Promise<PaymentMethod[]>;
  processPayment(data: ProcessPaymentRequest): Promise<PaymentProcessResult>;
}

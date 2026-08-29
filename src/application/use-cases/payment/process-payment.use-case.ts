import { Injectable, Inject } from '@nestjs/common';
import type {
  PaymentRepository,
  ProcessPaymentRequest,
  PaymentProcessResult,
} from '../../../domain/ports/out/payment-repository.interface';

@Injectable()
export class ProcessPaymentUseCase {
  constructor(
    @Inject('PaymentRepository')
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async execute(dto: ProcessPaymentRequest): Promise<PaymentProcessResult> {
    return this.paymentRepository.processPayment(dto);
  }
}

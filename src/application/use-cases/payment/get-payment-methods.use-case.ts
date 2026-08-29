import { Injectable, Inject } from '@nestjs/common';
import type { PaymentRepository } from '../../../domain/ports/out/payment-repository.interface';
import { PaymentMethod } from '../../../domain/entities/payment-method.entity';

@Injectable()
export class GetPaymentMethodsUseCase {
  constructor(
    @Inject('PaymentRepository')
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async execute(): Promise<PaymentMethod[]> {
    return this.paymentRepository.getPaymentMethods();
  }
}

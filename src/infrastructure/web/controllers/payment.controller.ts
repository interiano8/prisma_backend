import { Controller, Get, Post, Body } from '@nestjs/common';
import { GetPaymentMethodsUseCase } from '../../../application/use-cases/payment/get-payment-methods.use-case';
import { ProcessPaymentUseCase } from '../../../application/use-cases/payment/process-payment.use-case';
import type { ProcessPaymentRequest } from '../../../domain/ports/out/payment-repository.interface';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly getPaymentMethods: GetPaymentMethodsUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
  ) {}

  @Get('methods')
  async getMethods() {
    return this.getPaymentMethods.execute();
  }

  @Post('process')
  async process(@Body() dto: ProcessPaymentRequest) {
    return this.processPayment.execute(dto);
  }
}

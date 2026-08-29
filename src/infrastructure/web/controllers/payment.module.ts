import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicesModule } from './invoices.module';
import { PaymentController } from './payment.controller';
import { GetPaymentMethodsUseCase } from '../../../application/use-cases/payment/get-payment-methods.use-case';
import { ProcessPaymentUseCase } from '../../../application/use-cases/payment/process-payment.use-case';
import { PaymentRepositoryImpl } from '../../persistence/repositories/payment-repository';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [PaymentController],
  providers: [
    GetPaymentMethodsUseCase,
    ProcessPaymentUseCase,
    { provide: 'PaymentRepository', useClass: PaymentRepositoryImpl },
  ],
})
export class PaymentModule {}

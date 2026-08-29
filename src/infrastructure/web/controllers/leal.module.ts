import { Module } from '@nestjs/common';
import { LealController } from './leal.controller';
import { LoginLealUseCase } from '../../../application/use-cases/leal/login-leal.use-case';
import { SearchLealCustomerUseCase } from '../../../application/use-cases/leal/search-leal-customer.use-case';
import { AccumulatePointsUseCase } from '../../../application/use-cases/leal/accumulate-points.use-case';
import { RedeemPointsUseCase } from '../../../application/use-cases/leal/redeem-points.use-case';
import { RegisterLealCustomerUseCase } from '../../../application/use-cases/leal/register-leal-customer.use-case';
import { ReverseTransactionUseCase } from '../../../application/use-cases/leal/reverse-transaction.use-case';
import { CheckLealStatusUseCase } from '../../../application/use-cases/leal/check-leal-status.use-case';
import { LealRepositoryImpl } from '../../persistence/repositories/leal-repository';
import { PrismaModule } from '../../../prisma/prisma.module';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';

@Module({
  imports: [PrismaModule],
  controllers: [LealController],
  providers: [
    {
      provide: 'LealRepository',
      useClass: LealRepositoryImpl,
    },
    {
      provide: LoginLealUseCase,
      useFactory: (repo: LealRepository) => new LoginLealUseCase(repo),
      inject: ['LealRepository'],
    },
    {
      provide: CheckLealStatusUseCase,
      useFactory: (repo: LealRepository) => new CheckLealStatusUseCase(repo),
      inject: ['LealRepository'],
    },
    {
      provide: SearchLealCustomerUseCase,
      useFactory: (repo: LealRepository) => new SearchLealCustomerUseCase(repo),
      inject: ['LealRepository'],
    },
    {
      provide: AccumulatePointsUseCase,
      useFactory: (repo: LealRepository) => new AccumulatePointsUseCase(repo),
      inject: ['LealRepository'],
    },
    {
      provide: RedeemPointsUseCase,
      useFactory: (repo: LealRepository) => new RedeemPointsUseCase(repo),
      inject: ['LealRepository'],
    },
    {
      provide: RegisterLealCustomerUseCase,
      useFactory: (repo: LealRepository) =>
        new RegisterLealCustomerUseCase(repo),
      inject: ['LealRepository'],
    },
    {
      provide: ReverseTransactionUseCase,
      useFactory: (repo: LealRepository) => new ReverseTransactionUseCase(repo),
      inject: ['LealRepository'],
    },
  ],
  exports: [LoginLealUseCase, 'LealRepository'],
})
export class LealModule {}

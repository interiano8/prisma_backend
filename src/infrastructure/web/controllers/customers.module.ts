import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomerRepositoryImpl } from '../../persistence/repositories/customer-repository';
import { SearchCustomersUseCase } from '../../../application/use-cases/customer/search-customers.use-case';
import { GetConsumidorFinalUseCase } from '../../../application/use-cases/customer/get-consumidor-final.use-case';
import { CreateCustomerUseCase } from '../../../application/use-cases/customer/create-customer.use-case';
import { GetCustomerByCodeUseCase } from '../../../application/use-cases/customer/get-customer-by-code.use-case';
import { CheckCustomerCreditUseCase } from '../../../application/use-cases/customer/check-customer-credit.use-case';
import type { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';
import { StoreConfigModule } from './store-config.module';

@Module({
  imports: [StoreConfigModule],
  controllers: [CustomersController],
  providers: [
    { provide: 'CustomerRepository', useClass: CustomerRepositoryImpl },
    {
      provide: SearchCustomersUseCase,
      useFactory: (repo: CustomerRepository) =>
        new SearchCustomersUseCase(repo),
      inject: ['CustomerRepository'],
    },
    {
      provide: GetConsumidorFinalUseCase,
      useFactory: (repo: CustomerRepository) =>
        new GetConsumidorFinalUseCase(repo),
      inject: ['CustomerRepository'],
    },
    {
      provide: CreateCustomerUseCase,
      useFactory: (repo: CustomerRepository) => new CreateCustomerUseCase(repo),
      inject: ['CustomerRepository'],
    },
    {
      provide: GetCustomerByCodeUseCase,
      useFactory: (repo: CustomerRepository) =>
        new GetCustomerByCodeUseCase(repo),
      inject: ['CustomerRepository'],
    },
    {
      provide: CheckCustomerCreditUseCase,
      useFactory: (
        customerRepo: CustomerRepository,
        storeConfigRepo: StoreConfigRepository,
      ) => new CheckCustomerCreditUseCase(customerRepo, storeConfigRepo),
      inject: ['CustomerRepository', 'StoreConfigRepository'],
    },
  ],
  exports: ['CustomerRepository', CheckCustomerCreditUseCase],
})
export class CustomersModule {}

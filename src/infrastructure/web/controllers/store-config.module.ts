import { Module } from '@nestjs/common';
import { StoreConfigController } from './store-config.controller';
import { StoreConfigRepositoryImpl } from '../../persistence/repositories/store-config-repository';
import { UpdateStoreConfigUseCase } from '../../../application/use-cases/store-config/update-store-config.use-case';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';

@Module({
  controllers: [StoreConfigController],
  providers: [
    { provide: 'StoreConfigRepository', useClass: StoreConfigRepositoryImpl },
    {
      provide: UpdateStoreConfigUseCase,
      useFactory: (repo: StoreConfigRepository) =>
        new UpdateStoreConfigUseCase(repo),
      inject: ['StoreConfigRepository'],
    },
  ],
  exports: ['StoreConfigRepository'],
})
export class StoreConfigModule {}

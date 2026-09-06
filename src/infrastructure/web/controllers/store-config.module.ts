import { Module } from '@nestjs/common';
import { StoreConfigController } from './store-config.controller';
import { TasasCambioController } from './tasas-cambio.controller';
import { StoreConfigRepositoryImpl } from '../../persistence/repositories/store-config-repository';
import { TasaCambioRepositoryImpl } from '../../persistence/repositories/tasa-cambio-repository';
import { UpdateStoreConfigUseCase } from '../../../application/use-cases/store-config/update-store-config.use-case';
import { TasaCambioUseCase } from '../../../application/use-cases/tasas-cambio/tasa-cambio.use-case';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';
import type { TasaCambioRepository } from '../../../domain/ports/out/tasa-cambio-repository.interface';

@Module({
  controllers: [StoreConfigController, TasasCambioController],
  providers: [
    { provide: 'StoreConfigRepository', useClass: StoreConfigRepositoryImpl },
    {
      provide: 'TasaCambioRepository',
      useClass: TasaCambioRepositoryImpl,
    },
    {
      provide: UpdateStoreConfigUseCase,
      useFactory: (repo: StoreConfigRepository) =>
        new UpdateStoreConfigUseCase(repo),
      inject: ['StoreConfigRepository'],
    },
    {
      provide: TasaCambioUseCase,
      useFactory: (
        repo: TasaCambioRepository,
        storeConfigRepo: StoreConfigRepository,
      ) => new TasaCambioUseCase(repo, storeConfigRepo),
      inject: ['TasaCambioRepository', 'StoreConfigRepository'],
    },
  ],
  exports: ['StoreConfigRepository'],
})
export class StoreConfigModule {}
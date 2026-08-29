import { Module } from '@nestjs/common';
import { PosConfigController } from './pos-config.controller';
import { PosConfigRepositoryImpl } from '../../persistence/repositories/pos-config-repository';
import { GetPosConfigUseCase } from '../../../application/use-cases/pos-config/get-pos-config.use-case';
import { UpdatePosConfigUseCase } from '../../../application/use-cases/pos-config/update-pos-config.use-case';
import type { PosConfigRepository } from '../../../domain/ports/out/pos-config-repository.interface';

@Module({
  controllers: [PosConfigController],
  providers: [
    { provide: 'PosConfigRepository', useClass: PosConfigRepositoryImpl },
    {
      provide: GetPosConfigUseCase,
      useFactory: (repo: PosConfigRepository) => new GetPosConfigUseCase(repo),
      inject: ['PosConfigRepository'],
    },
    {
      provide: UpdatePosConfigUseCase,
      useFactory: (repo: PosConfigRepository, get: GetPosConfigUseCase) =>
        new UpdatePosConfigUseCase(repo, get),
      inject: ['PosConfigRepository', GetPosConfigUseCase],
    },
  ],
  exports: ['PosConfigRepository'],
})
export class PosConfigModule {}

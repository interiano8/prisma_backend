import { Module } from '@nestjs/common';
import { ShiftController } from './shift.controller';
import { ShiftService } from '../../../application/services/shift.service';
import { DispensersModule } from './dispensers.module';
import { ShiftRepositoryImpl } from '../../persistence/repositories/shift-repository';
import { StoreConfigRepositoryImpl } from '../../persistence/repositories/store-config-repository';
import { GetShiftStatusUseCase } from '../../../application/use-cases/shift/get-shift-status.use-case';
import { OpenShiftUseCase } from '../../../application/use-cases/shift/open-shift.use-case';
import { CloseShiftUseCase } from '../../../application/use-cases/shift/close-shift.use-case';
import type { ShiftRepository } from '../../../domain/ports/out/shift-repository.interface';
import type { DispenserRepository } from '../../../domain/ports/out/dispenser-repository.interface';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';

@Module({
  imports: [DispensersModule],
  controllers: [ShiftController],
  providers: [
    ShiftService,
    { provide: 'ShiftRepository', useClass: ShiftRepositoryImpl },
    { provide: 'StoreConfigRepository', useClass: StoreConfigRepositoryImpl },
    {
      provide: GetShiftStatusUseCase,
      useFactory: (repo: ShiftRepository) => new GetShiftStatusUseCase(repo),
      inject: ['ShiftRepository'],
    },
    {
      provide: OpenShiftUseCase,
      useFactory: (repo: ShiftRepository) => new OpenShiftUseCase(repo),
      inject: ['ShiftRepository'],
    },
    {
      provide: CloseShiftUseCase,
      useFactory: (
        repo: ShiftRepository,
        dispenserRepo: DispenserRepository,
        storeConfigRepo: StoreConfigRepository,
      ) =>
        new CloseShiftUseCase(repo, dispenserRepo, storeConfigRepo),
      inject: [
        'ShiftRepository',
        'DispenserRepository',
        'StoreConfigRepository',
      ],
    },
  ],
  exports: [
    'ShiftRepository',
    GetShiftStatusUseCase,
    OpenShiftUseCase,
    CloseShiftUseCase,
  ],
})
export class ShiftModule {}

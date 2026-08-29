import { Module } from '@nestjs/common';
import { DispensersController } from './dispensers.controller';
import { DispensersService } from '../../../application/services/dispensers.service';
import { DispenserRepositoryImpl } from '../../persistence/repositories/dispenser-repository';

@Module({
  controllers: [DispensersController],
  providers: [
    DispensersService,
    { provide: 'DispenserRepository', useClass: DispenserRepositoryImpl },
  ],
  exports: [DispensersService, 'DispenserRepository'],
})
export class DispensersModule {}

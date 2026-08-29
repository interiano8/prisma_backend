import { Module } from '@nestjs/common';
import { DispensersModule } from './dispensers.module';
import { FusionSyncService } from '../../../application/services/fusion-sync.service';
import { FusionSyncController } from './fusion-sync.controller';

@Module({
  imports: [DispensersModule],
  providers: [FusionSyncService],
  controllers: [FusionSyncController],
  exports: [FusionSyncService],
})
export class FusionSyncModule {}

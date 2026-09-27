import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { CloudSyncService } from '../../../application/services/cloud-sync.service';
import { StoreBootstrapService } from '../../../application/services/store-bootstrap.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService, CloudSyncService, StoreBootstrapService],
  exports: [HealthService, CloudSyncService, StoreBootstrapService],
})
export class HealthModule {}

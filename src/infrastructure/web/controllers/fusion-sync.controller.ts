import { Controller, Get } from '@nestjs/common';
import { FusionSyncService } from '../../../application/services/fusion-sync.service';

@Controller('fusion-sync')
export class FusionSyncController {
  constructor(private readonly fusionSyncService: FusionSyncService) {}

  @Get('status')
  status() {
    return this.fusionSyncService.status;
  }
}

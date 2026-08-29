import { Test, TestingModule } from '@nestjs/testing';
import { FusionSyncController } from '../../../../src/infrastructure/web/controllers/fusion-sync.controller';
import { FusionSyncService } from '../../../../src/application/services/fusion-sync.service';

describe('FusionSyncController', () => {
  let controller: FusionSyncController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FusionSyncController],
      providers: [
        { provide: FusionSyncService, useValue: { status: 'connected' } },
      ],
    }).compile();

    controller = module.get(FusionSyncController);
  });

  it('status devuelve el estado del sync', () => {
    expect(controller.status()).toBe('connected');
  });
});

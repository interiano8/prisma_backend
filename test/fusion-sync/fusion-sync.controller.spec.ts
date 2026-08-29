import { Test, TestingModule } from '@nestjs/testing';
import { FusionSyncController } from '../../src/infrastructure/web/controllers/fusion-sync.controller';
import { FusionSyncService } from '../../src/application/services/fusion-sync.service';

describe('FusionSyncController', () => {
  it('status devuelve el estado del servicio', async () => {
    const status = {
      connected: false,
      lastSyncAt: null,
      lastInserted: 0,
      lastError: null,
    };
    const mockService = {
      status,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FusionSyncController],
      providers: [{ provide: FusionSyncService, useValue: mockService }],
    }).compile();

    const controller = module.get<FusionSyncController>(FusionSyncController);

    expect(controller.status()).toBe(status);
  });
});

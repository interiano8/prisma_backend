import { Test, TestingModule } from '@nestjs/testing';
import { DispensersController } from '../../src/infrastructure/web/controllers/dispensers.controller';
import { DispensersService } from '../../src/application/services/dispensers.service';

describe('DispensersController', () => {
  let controller: DispensersController;
  let mockService: {
    getDispensers: jest.Mock;
    getHoses: jest.Mock;
    getPumpTransactions: jest.Mock;
    authorizePump: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getDispensers: jest.fn(),
      getHoses: jest.fn(),
      getPumpTransactions: jest.fn(),
      authorizePump: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispensersController],
      providers: [{ provide: DispensersService, useValue: mockService }],
    }).compile();

    controller = module.get<DispensersController>(DispensersController);
  });

  it('getStatus delega en el servicio', async () => {
    mockService.getDispensers.mockResolvedValue([{ pumpId: 1 }]);

    expect(await controller.getStatus()).toEqual([{ pumpId: 1 }]);
  });

  it('getHoses delega en el servicio', async () => {
    mockService.getHoses.mockResolvedValue([]);

    expect(await controller.getHoses()).toEqual([]);
  });

  it('getTransactions convierte limit a número', async () => {
    mockService.getPumpTransactions.mockResolvedValue([]);

    await controller.getTransactions(1, '5');

    expect(mockService.getPumpTransactions).toHaveBeenCalledWith(1, 5);
  });

  it('authorize delega en el servicio', async () => {
    mockService.authorizePump.mockResolvedValue({ success: true });

    await expect(
      controller.authorize({ pumpId: 1, limitAmount: 100 }),
    ).resolves.toEqual({ success: true });
  });
});

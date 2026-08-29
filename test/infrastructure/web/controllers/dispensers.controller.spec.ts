import { Test, TestingModule } from '@nestjs/testing';
import { DispensersController } from '../../../../src/infrastructure/web/controllers/dispensers.controller';
import { DispensersService } from '../../../../src/application/services/dispensers.service';

describe('DispensersController', () => {
  let controller: DispensersController;
  let service: {
    getDispensers: jest.Mock;
    getHoses: jest.Mock;
    getPumpTransactions: jest.Mock;
    authorizePump: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getDispensers: jest.fn(),
      getHoses: jest.fn(),
      getPumpTransactions: jest.fn(),
      authorizePump: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispensersController],
      providers: [{ provide: DispensersService, useValue: service }],
    }).compile();

    controller = module.get(DispensersController);
  });

  it('getStatus delega en getDispensers', async () => {
    service.getDispensers.mockResolvedValue([{ pumpId: 1 }]);

    await expect(controller.getStatus()).resolves.toEqual([{ pumpId: 1 }]);
    expect(service.getDispensers).toHaveBeenCalled();
  });

  it('getHoses delega en getHoses', async () => {
    service.getHoses.mockResolvedValue([{ id: 1 }]);

    await expect(controller.getHoses()).resolves.toEqual([{ id: 1 }]);
  });

  it('getTransactions parsea el limit opcional', async () => {
    service.getPumpTransactions.mockResolvedValue([]);

    await controller.getTransactions(1, '5');
    expect(service.getPumpTransactions).toHaveBeenLastCalledWith(1, 5);

    await controller.getTransactions(1, undefined);
    expect(service.getPumpTransactions).toHaveBeenLastCalledWith(1, undefined);
  });

  it('authorize delega en authorizePump', () => {
    const dto = { pumpId: 1, limitAmount: 100 };
    service.authorizePump.mockReturnValue({ success: true });

    expect(controller.authorize(dto as never)).toEqual({ success: true });
    expect(service.authorizePump).toHaveBeenCalledWith(dto);
  });
});

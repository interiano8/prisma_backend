import { Test, TestingModule } from '@nestjs/testing';
import { PosConfigController } from '../../../../src/infrastructure/web/controllers/pos-config.controller';
import { GetPosConfigUseCase } from '../../../../src/application/use-cases/pos-config/get-pos-config.use-case';
import { UpdatePosConfigUseCase } from '../../../../src/application/use-cases/pos-config/update-pos-config.use-case';

describe('PosConfigController', () => {
  let controller: PosConfigController;
  let mockGet: { execute: jest.Mock };
  let mockUpdate: { execute: jest.Mock };

  beforeEach(async () => {
    mockGet = { execute: jest.fn() };
    mockUpdate = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosConfigController],
      providers: [
        { provide: GetPosConfigUseCase, useValue: mockGet },
        { provide: UpdatePosConfigUseCase, useValue: mockUpdate },
      ],
    }).compile();

    controller = module.get<PosConfigController>(PosConfigController);
  });

  it('get delega en el use-case', async () => {
    mockGet.execute.mockResolvedValue({ mostrarBombas: false });

    expect(await controller.get('01')).toEqual({ mostrarBombas: false });
    expect(mockGet.execute).toHaveBeenCalledWith('01');
  });

  it('update delega en el use-case', async () => {
    mockUpdate.execute.mockResolvedValue({ mostrarBombas: true });
    const body = { mostrarBombas: true };

    expect(await controller.update('01', body)).toEqual({
      mostrarBombas: true,
    });
    expect(mockUpdate.execute).toHaveBeenCalledWith('01', body);
  });
});

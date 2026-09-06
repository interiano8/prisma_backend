import { BadRequestException } from '@nestjs/common';
import { TasasCambioController } from './tasas-cambio.controller';

describe('TasasCambioController', () => {
  const useCase = {
    latest: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  let controller: TasasCambioController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TasasCambioController(useCase as any);
  });

  it('latest y list delegan', () => {
    useCase.latest.mockReturnValue({ tasa: 25 });
    useCase.list.mockReturnValue([]);

    expect(controller.latest()).toEqual({ tasa: 25 });
    controller.list();
    expect(useCase.list).toHaveBeenCalled();
  });

  it('create valida tasa positiva y delega', async () => {
    useCase.create.mockResolvedValue({});

    await controller.create({ tasa: 25 });

    expect(useCase.create).toHaveBeenCalledWith({ tasa: 25 });
    expect(() => controller.create({ tasa: 0 })).toThrow(BadRequestException);
    expect(() => controller.create({ tasa: NaN })).toThrow(BadRequestException);
  });

  it('update valida tasa si viene definida', async () => {
    useCase.update.mockResolvedValue({});

    await controller.update('1', {});
    expect(useCase.update).toHaveBeenCalledWith('1', {});

    expect(() => controller.update('1', { tasa: -1 })).toThrow(
      BadRequestException,
    );
  });

  it('remove delega y devuelve success', async () => {
    useCase.delete.mockResolvedValue(undefined);

    expect(await controller.remove('2')).toEqual({ success: true });
    expect(useCase.delete).toHaveBeenCalledWith('2');
  });
});
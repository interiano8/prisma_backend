import { StoreConfigController } from './store-config.controller';

describe('StoreConfigController', () => {
  const useCase = { execute: jest.fn() };
  let controller: StoreConfigController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new StoreConfigController(useCase as any);
  });

  it('update delega storeId y body', async () => {
    useCase.execute.mockResolvedValue({ storeId: '001', moneda: 'L.' });

    const result = await controller.update('001', { moneda: 'USD' });

    expect(result).toEqual({ storeId: '001', moneda: 'L.' });
    expect(useCase.execute).toHaveBeenCalledWith('001', { moneda: 'USD' });
  });
});
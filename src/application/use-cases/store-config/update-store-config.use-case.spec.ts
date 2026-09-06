import { UpdateStoreConfigUseCase } from './update-store-config.use-case';

describe('UpdateStoreConfigUseCase', () => {
  const repo = { update: jest.fn() };
  let useCase: UpdateStoreConfigUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateStoreConfigUseCase(repo as any);
  });

  it('trim de moneda con fallback a L. cuando queda vacío', async () => {
    repo.update.mockImplementation((_id: string, data: any) => ({
      storeId: '001',
      moneda: data.moneda || 'L.',
    }));

    await useCase.execute('001', { moneda: '   ' });

    expect(repo.update).toHaveBeenCalledWith('001', { moneda: 'L.' });
    expect(await useCase.execute('001', { moneda: 'USD' })).toEqual({
      storeId: '001',
      moneda: 'USD',
    });
  });

  it('trim de carpeta multimedia cuando viene definida', async () => {
    repo.update.mockResolvedValue({
      storeId: '001',
      moneda: 'L.',
      carpetaMultimedia: '/media',
    });

    const result = await useCase.execute('001', { carpetaMultimedia: ' /media ' });

    expect(repo.update).toHaveBeenCalledWith('001', { carpetaMultimedia: '/media' });
    expect(result.carpetaMultimedia).toBe('/media');
  });

  it('omite campos undefined y usa fallback de moneda del resultado', async () => {
    repo.update.mockResolvedValue({ storeId: '001', moneda: '' });

    const result = await useCase.execute('001', {});

    expect(repo.update).toHaveBeenCalledWith('001', {});
    expect(result).toEqual({ storeId: '001', moneda: 'L.' });
  });
});
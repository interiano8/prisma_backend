import { TasaCambioUseCase } from './tasa-cambio.use-case';

describe('TasaCambioUseCase', () => {
  const repo = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const storeConfigRepo = { findExchangeRate: jest.fn() };
  let useCase: TasaCambioUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new TasaCambioUseCase(repo as any, storeConfigRepo as any);
  });

  it('latest devuelve la tasa del día', async () => {
    storeConfigRepo.findExchangeRate.mockResolvedValue(25.4);

    const result = await useCase.latest();

    expect(result).toEqual({ tasa: 25.4 });
    expect(storeConfigRepo.findExchangeRate).toHaveBeenCalledWith(
      new Date().toISOString().split('T')[0],
    );
  });

  it('list delega', async () => {
    repo.list.mockResolvedValue([{ id: 1 }]);
    expect(await useCase.list()).toEqual([{ id: 1 }]);
  });

  it('create convierte tasa a número y fecha opcional', async () => {
    repo.create.mockResolvedValue({ id: 1 });
    await useCase.create({ tasa: '25.5', fecha: '2026-01-01' });
    await useCase.create({ tasa: '26' });

    expect(repo.create).toHaveBeenNthCalledWith(1, {
      tasa: 25.5,
      fecha: new Date('2026-01-01'),
    });
    expect(repo.create).toHaveBeenNthCalledWith(2, { tasa: 26, fecha: undefined });
  });

  it('update incluye solo los campos presentes', async () => {
    repo.update.mockResolvedValue({ id: 1 });
    await useCase.update('2', { tasa: '27' });

    expect(repo.update).toHaveBeenCalledWith(2, { tasa: 27 });

    await useCase.update('2', { fecha: '2026-02-01' });
    expect(repo.update).toHaveBeenLastCalledWith(2, { fecha: new Date('2026-02-01') });
  });

  it('delete delega el id numérico', async () => {
    await useCase.delete('4');
    expect(repo.delete).toHaveBeenCalledWith(4);
  });
});
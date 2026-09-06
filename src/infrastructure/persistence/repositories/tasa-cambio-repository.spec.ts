import { TasaCambioRepositoryImpl } from './tasa-cambio-repository';

describe('TasaCambioRepositoryImpl', () => {
  const tasaCambio = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  let repo: TasaCambioRepositoryImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TasaCambioRepositoryImpl({ tasaCambio } as any);
  });

  it('list mapea tasa a número y ordena por fecha desc', async () => {
    tasaCambio.findMany.mockResolvedValue([
      { id: 1, tasa: '25.5', fecha: new Date() },
    ]);

    const rows = await repo.list();

    expect(rows).toEqual([{ id: 1, tasa: 25.5, fecha: expect.any(Date) }]);
    expect(tasaCambio.findMany).toHaveBeenCalledWith({ orderBy: { fecha: 'desc' } });
  });

  it('create usa fecha por defecto si no viene', async () => {
    tasaCambio.create.mockResolvedValue({ id: 1, tasa: '25', fecha: new Date() });
    await repo.create({ tasa: 25 });
    expect(tasaCambio.create).toHaveBeenCalledWith({
      data: { tasa: 25, fecha: expect.any(Date) },
    });
  });

  it('update incluye solo campos definidos', async () => {
    tasaCambio.update.mockResolvedValue({ id: 1, tasa: '26', fecha: new Date() });
    await repo.update(2, { tasa: 26 });
    expect(tasaCambio.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { tasa: 26 },
    });
  });

  it('delete borra por id', async () => {
    tasaCambio.delete.mockResolvedValue({});
    await repo.delete(3);
    expect(tasaCambio.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
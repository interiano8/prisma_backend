import { SeriesRepositoryImpl } from './series-repository';

describe('SeriesRepositoryImpl', () => {
  const serieDocumento = {
    findMany: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  let repo: SeriesRepositoryImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SeriesRepositoryImpl({ serieDocumento } as any);
  });

  const row = {
    numeroLinea: 1,
    codigoSerie: 'FV-HN',
    idTienda: '001',
    codigoPos: '01',
    fechaInicio: new Date(),
    numeroInicio: 'FV0000000000000001',
    numeroFin: 'FV0000000000009999',
    numeroAviso: null,
    incremento: 1,
    ultimoNumeroUsado: 'FV0000000000000100',
    abierta: true,
    cai: 'CAI-1',
    rangoDesde: 'FV0000000000000001',
    rangoHasta: 'FV0000000000009999',
    fechaVenceRango: new Date('2027-01-01'),
    enEdicion: false,
  };

  it('list mapea con remaining y remainingDays', async () => {
    serieDocumento.findMany.mockResolvedValue([row]);

    const result = await repo.list('001', '01');

    expect(result[0]).toMatchObject({
      codigoSerie: 'FV-HN',
      remaining: 9899,
      remainingDays: expect.any(Number),
    });
    expect(serieDocumento.findMany).toHaveBeenCalledWith({
      where: { idTienda: '001', codigoPos: '01' },
      orderBy: [
        { codigoSerie: 'asc' },
        { codigoPos: 'asc' },
        { numeroLinea: 'asc' },
      ],
    });
  });

  it('list sin filtros no incluye where y remainingDays 0 sin fecha', async () => {
    serieDocumento.findMany.mockResolvedValue([
      { ...row, numeroFin: null, ultimoNumeroUsado: null, fechaVenceRango: null },
    ]);

    const result = await repo.list();

    expect(serieDocumento.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: expect.any(Array),
    });
    expect(result[0].remaining).toBe(0);
    expect(result[0].remainingDays).toBe(0);
  });

  it('create usa decrementNum de numeroInicio como último usado por defecto', async () => {
    serieDocumento.aggregate.mockResolvedValue({ _max: { numeroLinea: 1 } });
    serieDocumento.create.mockResolvedValue({ numeroLinea: 1001 });

    const result = await repo.create({
      codigoSerie: 'FV-HN',
      idTienda: '001',
      codigoPos: '01',
      numeroInicio: 'FV0000000000000010',
      numeroFin: 'FV0000000000000020',
    });

    expect(result).toEqual({ numeroLinea: 1001 });
    expect(serieDocumento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        numeroLinea: 1001,
        ultimoNumeroUsado: 'FV0000000000000009',
        incremento: 1,
        abierta: true,
        cai: null,
        enEdicion: false,
      }),
    });
  });

  it('create usa ultimoNumeroUsado cuando viene definido', async () => {
    serieDocumento.aggregate.mockResolvedValue({ _max: { numeroLinea: null } });
    serieDocumento.create.mockResolvedValue({ numeroLinea: 1000 });

    await repo.create({
      codigoSerie: 'TR-ID',
      idTienda: '001',
      codigoPos: '01',
      numeroInicio: 'TR0000000000000001',
      numeroFin: 'TR0000000000000010',
      ultimoNumeroUsado: 'TR0000000000000005',
      numeroAviso: 5,
      cai: 'CAI',
      rangoDesde: 'TR0000000000000001',
      rangoHasta: 'TR0000000000000010',
      fechaVenceRango: '2027-01-01',
    });

    expect(serieDocumento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ultimoNumeroUsado: 'TR0000000000000005',
        numeroAviso: '5',
        cai: 'CAI',
        fechaVenceRango: new Date('2027-01-01'),
      }),
    });
  });

  it('update incluye solo los campos definidos y resetea enEdicion', async () => {
    serieDocumento.update.mockResolvedValue({});

    await repo.update(1, 'FV-HN', { numeroFin: 'FV0000000000009998', abierta: false });

    expect(serieDocumento.update).toHaveBeenCalledWith({
      where: { numeroLinea_codigoSerie: { numeroLinea: 1, codigoSerie: 'FV-HN' } },
      data: {
        numeroFin: 'FV0000000000009998',
        abierta: false,
        enEdicion: false,
      },
    });
  });

  it('close y setEditing delegan el update', async () => {
    serieDocumento.update.mockResolvedValue({});

    await repo.close(1, 'FV-HN');
    expect(serieDocumento.update).toHaveBeenLastCalledWith({
      where: { numeroLinea_codigoSerie: { numeroLinea: 1, codigoSerie: 'FV-HN' } },
      data: { abierta: false },
    });

    await repo.setEditing(2, 'NC-HN', true);
    expect(serieDocumento.update).toHaveBeenLastCalledWith({
      where: { numeroLinea_codigoSerie: { numeroLinea: 2, codigoSerie: 'NC-HN' } },
      data: { enEdicion: true },
    });
  });
});
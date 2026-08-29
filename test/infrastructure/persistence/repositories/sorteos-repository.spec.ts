import { SorteosRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/sorteos-repository';

describe('SorteosRepositoryImpl', () => {
  it('getActiveSorteos mapea los sorteos activos', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 1, nombre: 'Sorteo X', textoTicket: '¡Ganaste!' },
      ]);
    const repo = new SorteosRepositoryImpl({ sorteo: { findMany } } as any);

    const sorteos = await repo.getActiveSorteos();

    expect(sorteos[0]).toEqual({
      SorteoID: 1,
      Nombre: 'Sorteo X',
      TextoTicket: '¡Ganaste!',
    });
  });

  it('getFuelCodes devuelve códigos en mayúsculas', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ codigoPos: 'super' }, { codigoPos: 'diesel' }]);
    const repo = new SorteosRepositoryImpl({ manguera: { findMany } } as any);

    const codes = await repo.getFuelCodes();

    expect(codes).toEqual(['SUPER', 'DIESEL']);
  });

  it('getItemCategories devuelve categorías por producto', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ codigo: 'P1', codigoCategoria: 'CAT1' }]);
    const repo = new SorteosRepositoryImpl({ producto: { findMany } } as any);

    const rows = await repo.getItemCategories(['P1']);

    expect(rows[0]).toEqual({ No_: 'P1', 'Item Category Code': 'CAT1' });
  });

  it('getSorteoConditions mapea las condiciones', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        tipoEvaluacion: 'MONTO_MINIMO',
        valorRequerido: '500',
        valorTexto: null,
        valorMonto: 500,
        valorCantidad: null,
        operador: '>=',
      },
    ]);
    const repo = new SorteosRepositoryImpl({
      condicionSorteo: { findMany },
    } as any);

    const conditions = await repo.getSorteoConditions(1);

    expect(conditions[0]).toEqual({
      TipoEvaluacion: 'MONTO_MINIMO',
      ValorRequerido: '500',
      ValorTexto: '',
      ValorMonto: 500,
      ValorCantidad: 0,
      Operador: '>=',
    });
  });

  it('saveWonSorteo crea el registro en ventas_sorteo', async () => {
    const create = jest.fn().mockResolvedValue({});
    const repo = new SorteosRepositoryImpl({ ventaSorteo: { create } } as any);

    await repo.saveWonSorteo('TX1', 'CORR1', 1);

    expect(create).toHaveBeenCalledWith({
      data: { idTransaccionPos: 'TX1', correlativo: 'CORR1', idSorteo: 1 },
    });
  });

  it('getActiveSorteos devuelve [] ante error', async () => {
    const repo = new SorteosRepositoryImpl({
      sorteo: { findMany: jest.fn().mockRejectedValue(new Error('db')) },
    } as any);

    await expect(repo.getActiveSorteos()).resolves.toEqual([]);
  });

  it('getFuelCodes filtra vacíos y devuelve [] ante error', async () => {
    const empty = new SorteosRepositoryImpl({
      manguera: {
        findMany: jest.fn().mockResolvedValue([{ codigoPos: null }]),
      },
    } as any);
    const failing = new SorteosRepositoryImpl({
      manguera: { findMany: jest.fn().mockRejectedValue(new Error('db')) },
    } as any);

    await expect(empty.getFuelCodes()).resolves.toEqual([]);
    await expect(failing.getFuelCodes()).resolves.toEqual([]);
  });

  it('getItemCategories devuelve [] con códigos vacíos o ante error', async () => {
    const empty = new SorteosRepositoryImpl({} as any);
    const failing = new SorteosRepositoryImpl({
      producto: { findMany: jest.fn().mockRejectedValue(new Error('db')) },
    } as any);

    await expect(empty.getItemCategories([])).resolves.toEqual([]);
    await expect(failing.getItemCategories(['P1'])).resolves.toEqual([]);
  });

  it('getSorteoConditions devuelve [] ante error', async () => {
    const repo = new SorteosRepositoryImpl({
      condicionSorteo: {
        findMany: jest.fn().mockRejectedValue(new Error('db')),
      },
    } as any);

    await expect(repo.getSorteoConditions(1)).resolves.toEqual([]);
  });

  it('saveWonSorteo captura errores sin lanzarlos', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const repo = new SorteosRepositoryImpl({
      ventaSorteo: { create: jest.fn().mockRejectedValue(new Error('db')) },
    } as any);

    await expect(repo.saveWonSorteo('TX', 'C', 1)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('getActiveSorteos aplica fallback con nombre nulo', async () => {
    const repo = new SorteosRepositoryImpl({
      sorteo: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, nombre: null, textoTicket: null }]),
      },
    } as any);

    const sorteos = await repo.getActiveSorteos();

    expect(sorteos[0]).toEqual({
      SorteoID: 1,
      Nombre: '',
      TextoTicket: null,
    });
  });

  it('getItemCategories aplica fallback con categoría nula', async () => {
    const repo = new SorteosRepositoryImpl({
      producto: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ codigo: 'P1', codigoCategoria: null }]),
      },
    } as any);

    const rows = await repo.getItemCategories(['P1']);

    expect(rows[0]).toEqual({ No_: 'P1', 'Item Category Code': '' });
  });

  it('getSorteoConditions aplica fallbacks con campos nulos', async () => {
    const repo = new SorteosRepositoryImpl({
      condicionSorteo: {
        findMany: jest.fn().mockResolvedValue([
          {
            tipoEvaluacion: null,
            valorRequerido: null,
            valorTexto: null,
            valorMonto: null,
            valorCantidad: null,
            operador: null,
          },
        ]),
      },
    } as any);

    const conditions = await repo.getSorteoConditions(1);

    expect(conditions[0]).toEqual({
      TipoEvaluacion: '',
      ValorRequerido: '',
      ValorTexto: '',
      ValorMonto: 0,
      ValorCantidad: 0,
      Operador: '',
    });
  });
});

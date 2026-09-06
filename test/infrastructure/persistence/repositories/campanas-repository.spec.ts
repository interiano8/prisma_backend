import { CampanasRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/campanas-repository';

describe('CampanasRepositoryImpl', () => {
  it('getActiveCampanas mapea las campañas activas', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        nombre: 'Campana X',
        textoTicket: '¡Ganaste!',
        modoEvaluacion: 'ALL',
        limitePorCliente: null,
      },
    ]);
    const repo = new CampanasRepositoryImpl({ campana: { findMany } } as any);
    const campanas = await repo.getActiveCampanas();
    expect(campanas[0]).toEqual({
      CampanaID: 1,
      Nombre: 'Campana X',
      TextoTicket: '¡Ganaste!',
      ModoEvaluacion: 'ALL',
      LimitePorCliente: null,
    });
  });

  it('getActiveCampanas devuelve [] ante error', async () => {
    const repo = new CampanasRepositoryImpl({
      campana: {
        findMany: jest.fn().mockRejectedValue(new Error('db')),
      },
    } as any);
    await expect(repo.getActiveCampanas()).resolves.toEqual([]);
  });

  it('getCampanaConditions mapea las condiciones', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        tipoEvaluacion: 'TOTAL_FACTURA',
        operador: 'GTE',
        valorTexto: null,
        valorMonto: 500,
        valorCantidad: null,
      },
    ]);
    const repo = new CampanasRepositoryImpl({
      condicionCampana: { findMany },
    } as any);
    const conditions = await repo.getCampanaConditions(1);
    expect(conditions[0]).toEqual({
      TipoEvaluacion: 'TOTAL_FACTURA',
      Operador: 'GTE',
      ValorTexto: '',
      ValorMonto: 500,
      ValorCantidad: 0,
    });
  });

  it('countParticipaciones cuenta por campaña y cliente', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const repo = new CampanasRepositoryImpl({
      participacionCampana: { count },
    } as any);
    await expect(repo.countParticipaciones(1, 'C1')).resolves.toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: { idCampana: 1, codigoCliente: 'C1' },
    });
  });

  it('saveParticipacion crea el registro con snapshot de cliente', async () => {
    const create = jest.fn().mockResolvedValue({});
    const repo = new CampanasRepositoryImpl({
      participacionCampana: { create },
    } as any);
    await repo.saveParticipacion({
      posTransactionId: 'TX1',
      correlativo: 'CORR1',
      campanaId: 1,
      codigoCliente: 'C1',
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        idTransaccionPos: 'TX1',
        correlativo: 'CORR1',
        idCampana: 1,
        codigoCliente: 'C1',
      },
    });
  });

  it('saveParticipacion captura errores sin lanzarlos', async () => {
    const repo = new CampanasRepositoryImpl({
      participacionCampana: {
        create: jest.fn().mockRejectedValue(new Error('db')),
      },
    } as any);
    await expect(
      repo.saveParticipacion({
        posTransactionId: 'TX',
        correlativo: 'C',
        campanaId: 1,
        codigoCliente: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('getTicketByCorrelativo une con la campaña', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      correlativo: 'CORR1',
      idCampana: 1,
      campana: { nombre: 'Campana 1' },
      idTransaccionPos: 'TX1',
      codigoCliente: 'C1',
    });
    const repo = new CampanasRepositoryImpl({
      participacionCampana: { findFirst },
    } as any);
    const ticket = await repo.getTicketByCorrelativo('CORR1');
    expect(ticket).toEqual({
      correlativo: 'CORR1',
      campanaId: 1,
      nombreCampana: 'Campana 1',
      idTransaccionPos: 'TX1',
      codigoCliente: 'C1',
    });
  });

  it('getTicketByCorrelativo devuelve null si no existe', async () => {
    const repo = new CampanasRepositoryImpl({
      participacionCampana: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any);
    await expect(repo.getTicketByCorrelativo('NOPE')).resolves.toBeNull();
  });

  it('listCampanas mapea con condiciones y devuelve [] ante error', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        nombre: 'C',
        fechaInicio: null,
        fechaFin: null,
        activo: true,
        textoTicket: 'T',
        modoEvaluacion: 'ALL',
        limitePorCliente: 2,
        condiciones: [
          { id: 10, tipoEvaluacion: 'MIN', operador: '>=', valorTexto: null, valorMonto: '5', valorCantidad: null },
        ],
        _count: { participaciones: 3 },
      },
    ]);
    const repo = new CampanasRepositoryImpl({ campana: { findMany } } as any);
    const rows = await repo.listCampanas();
    expect(rows[0]).toMatchObject({
      id: 1,
      participacionesCount: 3,
      condiciones: [{ id: 10, TipoEvaluacion: 'MIN', Operador: '>=', ValorTexto: '', ValorMonto: 5, ValorCantidad: 0 }],
    });

    findMany.mockRejectedValueOnce(new Error('db'));
    expect(await repo.listCampanas()).toEqual([]);
  });

  it('CRUD de campañas y condiciones delega', async () => {
    const campana = {
      create: jest.fn().mockResolvedValue({ id: 7 }),
      update: jest.fn().mockResolvedValue({ id: 7 }),
    };
    const condicionCampana = {
      create: jest.fn().mockResolvedValue({ id: 8 }),
      update: jest.fn().mockResolvedValue({ id: 8 }),
      delete: jest.fn().mockResolvedValue({}),
    };
    const repo = new CampanasRepositoryImpl({ campana, condicionCampana } as any);

    expect(await repo.createCampana({ nombre: 'N' } as any)).toEqual({ id: 7 });
    expect(await repo.updateCampana(1, { nombre: 'N2' } as any)).toEqual({ id: 7 });
    await repo.deleteCampana(1);
    expect(campana.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { activo: false },
    });

    expect(await repo.createCondicion(1, { operador: '>=' } as any)).toEqual({ id: 8 });
    expect(await repo.updateCondicion(2, { operador: '<=' } as any)).toEqual({ id: 8 });
    await repo.deleteCondicion(3);
    expect(condicionCampana.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });

  it('getItemCategories mapea y captura errores', async () => {
    const repo = new CampanasRepositoryImpl({} as any);
    expect(await repo.getItemCategories([])).toEqual([]);

    const producto = { findMany: jest.fn().mockResolvedValue([{ codigo: 'P1', codigoCategoria: null }]) };
    const repo2 = new CampanasRepositoryImpl({ producto } as any);
    const rows = await repo2.getItemCategories(['P1']);
    expect(rows).toEqual([{ No_: 'P1', 'Item Category Code': '' }]);

    producto.findMany.mockRejectedValueOnce(new Error('db'));
    expect(await repo2.getItemCategories(['P1'])).toEqual([]);
  });
});

import { ParkedSalesRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/parked-sales-repository';

describe('ParkedSalesRepositoryImpl', () => {
  it('create genera correlativo A-1 cuando count es 0', async () => {
    const count = jest.fn().mockResolvedValue(0);
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'uuid-1',
        ...data,
        fechaCreacion: new Date(),
        fechaActualizado: new Date(),
      }),
    );

    const repo = new ParkedSalesRepositoryImpl({
      ventaAparcada: { count, create },
    } as any);

    const res = await repo.create({
      storeId: '001',
      posNo: 'POS01',
      usuario: 'cajero1',
      turnoId: '101',
      items: [{ code: '01', qty: 1 }],
      total: 50,
      nota: 'Prueba',
    });

    expect(res.codigo).toBe('A-1');
    expect(res.total).toBe(50);
    expect(res.estado).toBe('PARKED');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('create genera correlativo A-3 cuando count es 2', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'uuid-3',
        ...data,
        fechaCreacion: new Date(),
        fechaActualizado: new Date(),
      }),
    );

    const repo = new ParkedSalesRepositoryImpl({
      ventaAparcada: { count, create },
    } as any);

    const res = await repo.create({
      storeId: '001',
      posNo: 'POS01',
      usuario: 'cajero1',
      turnoId: '101',
      items: [],
      total: 100,
    });

    expect(res.codigo).toBe('A-3');
  });

  it('listActive consulta solo ventas con estado PARKED', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'uuid-1',
        codigo: 'A-1',
        storeId: '001',
        posNo: 'POS01',
        usuario: 'cajero1',
        turnoId: '101',
        items: [],
        total: '100.00',
        estado: 'PARKED',
        fechaCreacion: new Date(),
        fechaActualizado: new Date(),
      },
    ]);

    const repo = new ParkedSalesRepositoryImpl({
      ventaAparcada: { findMany },
    } as any);

    const list = await repo.listActive('001');
    expect(list.length).toBe(1);
    expect(list[0].total).toBe(100);
    expect(findMany).toHaveBeenCalledWith({
      where: { storeId: '001', estado: 'PARKED' },
      orderBy: { fechaCreacion: 'desc' },
    });
  });

  it('markResumed y markDiscarded actualizan estado', async () => {
    const update = jest.fn().mockImplementation(({ where, data }) =>
      Promise.resolve({
        id: where.id,
        codigo: 'A-1',
        storeId: '001',
        posNo: 'POS01',
        usuario: 'cajero1',
        turnoId: '101',
        items: [],
        total: 100,
        estado: data.estado,
        fechaCreacion: new Date(),
        fechaActualizado: new Date(),
      }),
    );

    const repo = new ParkedSalesRepositoryImpl({
      ventaAparcada: { update },
    } as any);

    const r = await repo.markResumed('uuid-1');
    expect(r.estado).toBe('RESUMED');

    const d = await repo.markDiscarded('uuid-1');
    expect(d.estado).toBe('DISCARDED');
  });

  it('expirePendingByShift actualiza ventas a EXPIRED', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });

    const repo = new ParkedSalesRepositoryImpl({
      ventaAparcada: { updateMany },
    } as any);

    const count = await repo.expirePendingByShift('001', 'cajero1', '101');
    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        storeId: '001',
        usuario: 'cajero1',
        turnoId: '101',
        estado: 'PARKED',
      },
      data: { estado: 'EXPIRED' },
    });
  });
});

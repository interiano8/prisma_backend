import { DispenserRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/dispenser-repository';

describe('DispenserRepositoryImpl', () => {
  const origFetch = global.fetch;
  const ok = (data: any, status = 200) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve({ data }),
    } as Response);
  const fail = () => Promise.reject(new Error('network'));

  afterEach(() => {
    global.fetch = origFetch;
  });

  it('getPendingSales devuelve las ventas pendientes del controlador', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([
        { saleId: 1, pumpId: 3, amount: 500, ppu: 30.5, volume: 16.39, grade: 1 },
      ]),
    );
    const repo = new DispenserRepositoryImpl({} as any);

    const sales = await repo.getPendingSales();

    expect(sales[0]).toEqual(
      expect.objectContaining({ SaleID: 1, PumpNumber: 3, IsInvoiced: false }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sales/pending'),
      undefined,
    );
  });

  it('getPendingSales devuelve [] si falla la llamada', async () => {
    global.fetch = fail;
    const repo = new DispenserRepositoryImpl({} as any);
    await expect(repo.getPendingSales()).resolves.toEqual([]);
  });

  it('getSaleById devuelve null si no existe', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok(null, 404));
    const repo = new DispenserRepositoryImpl({} as any);
    await expect(repo.getSaleById(999)).resolves.toBeNull();
  });

  it('getSaleById mapea todos los campos', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({
        saleId: 5,
        pumpId: 2,
        hoseId: 3,
        amount: 100,
        ppu: 40,
        volume: 2.5,
        grade: 1,
        clearedAt: '2026-08-15T10:00:00Z',
      }),
    );
    const repo = new DispenserRepositoryImpl({} as any);

    const sale = await repo.getSaleById(5);

    expect(sale).toEqual({
      PumpNumber: 2,
      HoseNumber: '3',
      amount: 100,
      ppu: 40,
      volume: 2.5,
      GradeNr: 1,
      IsInvoiced: true,
    });
  });

  it('getSaleById devuelve null si falla la red', async () => {
    global.fetch = fail;
    const repo = new DispenserRepositoryImpl({} as any);
    await expect(repo.getSaleById(5)).resolves.toBeNull();
  });

  it('getHoseFsMapping mapea CodigoPOS y TankIDs', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ codigoPos: 'SUPER', idsTanques: 'T1,T2' });
    const repo = new DispenserRepositoryImpl({
      manguera: { findFirst },
    } as any);

    const mapping = await repo.getHoseFsMapping(1, 2);

    expect(mapping).toEqual({ CodigoPOS: 'SUPER', TankIDs: 'T1,T2' });
  });

  it('getItemMetadata mapea los campos del producto', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      descripcion: 'SUPER',
      grupoIsv: 'ISV_15',
      codigoCategoria: 'COMB',
      generaAsientoBomba: true,
    });
    const repo = new DispenserRepositoryImpl({
      producto: { findUnique },
    } as any);

    const meta = await repo.getItemMetadata('SUPER');

    expect(meta!.Description).toBe('SUPER');
    expect(meta!['VAT Prod_ Posting Group']).toBe('ISV_15');
    expect(meta!['Gen_ Pump Ledg_ Entry']).toBe(1);
  });

  it('getHoseConfigs divide el precio escalado por 100000', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        idManguera: 1,
        numeroGrado: 1,
        nombreGrado: 'SUPER',
        precioUnitario: 2921000,
        idBomba: 1,
        idMangueraFisica: 1,
        codigoPos: 'SUPER',
        visible: true,
      },
    ]);
    const repo = new DispenserRepositoryImpl({ manguera: { findMany } } as any);

    const hoses = await repo.getHoseConfigs();

    expect(hoses[0].pricePerUnit).toBeCloseTo(29.21);
    expect(hoses[0].gradeName).toBe('SUPER');
  });

  it('updateSaleInvoiced llama al clear del controlador', async () => {
    const clear = jest.fn().mockResolvedValue(ok({ success: true }));
    global.fetch = clear;
    const repo = new DispenserRepositoryImpl({} as any);

    await repo.updateSaleInvoiced('123', '01');

    expect(clear).toHaveBeenCalledWith(
      expect.stringContaining('/api/sales/123/clear'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updateSaleInvoiced no lanza si el controlador falla', async () => {
    global.fetch = fail;
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const repo = new DispenserRepositoryImpl({} as any);

    await expect(repo.updateSaleInvoiced('123', '01')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renewTransactions es no-op (el controlador es dueño)', async () => {
    const repo = new DispenserRepositoryImpl({} as any);
    expect(await repo.renewTransactions()).toBe(0);
  });

  it('getHoseFsForPos devuelve los PumpID distintos', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ idBomba: 1 }, { idBomba: 2 }]);
    const repo = new DispenserRepositoryImpl({ manguera: { findMany } } as any);

    const pumps = await repo.getHoseFsForPos('01');

    expect(pumps).toEqual([{ PumpID: 1 }, { PumpID: 2 }]);
  });

  it('getHoseFsMapping devuelve null si no hay manguera', async () => {
    const repo = new DispenserRepositoryImpl({
      manguera: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.getHoseFsMapping(1, 2)).resolves.toBeNull();
  });

  it('getItemMetadata devuelve null si no existe el producto', async () => {
    const repo = new DispenserRepositoryImpl({
      producto: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.getItemMetadata('NOPE')).resolves.toBeNull();
  });

  it('getItemMetadata mapea generaAsientoBomba falso a 0', async () => {
    const repo = new DispenserRepositoryImpl({
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          descripcion: 'DIESEL',
          grupoIsv: 'ISV_18',
          codigoCategoria: 'COMB',
          generaAsientoBomba: false,
        }),
      },
    } as any);

    const meta = await repo.getItemMetadata('DIESEL');

    expect(meta!['Gen_ Pump Ledg_ Entry']).toBe(0);
  });

  it('getHoseConfigs devuelve [] si falla y maneja nulos', async () => {
    const repo = new DispenserRepositoryImpl({
      manguera: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    } as any);
    await expect(repo.getHoseConfigs()).resolves.toEqual([]);

    const okRepo = new DispenserRepositoryImpl({
      manguera: {
        findMany: jest.fn().mockResolvedValue([
          {
            idManguera: 2,
            numeroGrado: null,
            nombreGrado: '',
            precioUnitario: 1000,
            idBomba: null,
            idMangueraFisica: null,
            codigoPos: null,
            visible: null,
          },
        ]),
      },
    } as any);

    const hoses = await okRepo.getHoseConfigs();
    expect(hoses[0]).toMatchObject({
      gradeNumber: 0,
      gradeName: '',
      pumpId: 0,
      hosePhysicalId: 0,
      codigoPos: '',
      esVisible: false,
    });
  });

  it('getSimpleHoseConfigs mapea y devuelve [] en error', async () => {
    const repo = new DispenserRepositoryImpl({
      manguera: {
        findMany: jest.fn().mockResolvedValue([
          {
            idBomba: 1,
            nombreGrado: 'SUPER',
            precioUnitario: 2921000,
            pos: 'POS01',
          },
        ]),
      },
    } as any);

    const simple = await repo.getSimpleHoseConfigs();
    expect(simple[0]).toEqual({
      pumpId: 1,
      productName: 'SUPER',
      unitPrice: 29.21,
      pos: 'POS01',
    });

    const fail = new DispenserRepositoryImpl({
      manguera: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    } as any);
    await expect(fail.getSimpleHoseConfigs()).resolves.toEqual([]);
  });

  it('reverseFusionSale llama al reverse del controlador y traga errores', async () => {
    const reverse = jest.fn().mockResolvedValue(ok({ success: true }));
    global.fetch = reverse;
    const repo = new DispenserRepositoryImpl({} as any);

    await repo.reverseFusionSale('7');
    expect(reverse).toHaveBeenCalledWith(
      expect.stringContaining('/api/sales/7/reverse'),
      expect.objectContaining({ method: 'POST' }),
    );

    const warn = jest.spyOn(console, 'warn').mockImplementation();
    global.fetch = fail;
    await repo.reverseFusionSale('8');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('getHoseFsForPos devuelve [] en error', async () => {
    const repo = new DispenserRepositoryImpl({
      manguera: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
    } as any);

    await expect(repo.getHoseFsForPos('01')).resolves.toEqual([]);
  });

  it('countPendingSalesForPos filtra las bombas del POS', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([
        { saleId: 1, pumpId: 1 },
        { saleId: 2, pumpId: 2 },
        { saleId: 3, pumpId: 3 },
      ]),
    );
    const manguera = jest
      .fn()
      .mockResolvedValue([{ idBomba: 1 }, { idBomba: null }, { idBomba: 2 }]);
    const repo = new DispenserRepositoryImpl({
      manguera: { findMany: manguera },
    } as any);

    const total = await repo.countPendingSalesForPos('POS01');

    expect(total).toBe(2);
  });

  it('countPendingSalesForPos devuelve 0 sin bombas o en error', async () => {
    const empty = new DispenserRepositoryImpl({
      manguera: { findMany: jest.fn().mockResolvedValue([{ idBomba: null }]) },
    } as any);
    await expect(empty.countPendingSalesForPos('POS01')).resolves.toBe(0);

    const fail = new DispenserRepositoryImpl({
      manguera: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
    } as any);
    await expect(fail.countPendingSalesForPos('POS01')).resolves.toBe(0);
  });

  it('getExistingSaleIds devuelve [] si falla la red', async () => {
    global.fetch = fail;
    const repo = new DispenserRepositoryImpl({} as any);
    await expect(repo.getExistingSaleIds()).resolves.toEqual([]);
  });

  it('countPendingSalesForPos devuelve 0 si falla el controlador', async () => {
    global.fetch = fail;
    const manguera = jest
      .fn()
      .mockResolvedValue([{ idBomba: 1 }, { idBomba: 2 }]);
    const repo = new DispenserRepositoryImpl({
      manguera: { findMany: manguera },
    } as any);
    await expect(repo.countPendingSalesForPos('POS01')).resolves.toBe(0);
  });

  it('getExistingSaleIds devuelve los ids pendientes del controlador', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([
        { saleId: 1, pumpId: 1 },
        { saleId: 2, pumpId: 2 },
      ]),
    );
    const repo = new DispenserRepositoryImpl({} as any);

    await expect(repo.getExistingSaleIds()).resolves.toEqual([1, 2]);
  });

  it('createSales es no-op (el controlador persiste)', async () => {
    const repo = new DispenserRepositoryImpl({} as any);
    await expect(repo.createSales([] as any)).resolves.toBe(0);
    const data = Array.from({ length: 1500 }, (_, i) => ({ idVenta: i }));
    await expect(repo.createSales(data as any)).resolves.toBe(0);
  });

  it('getPumpTransactions mapea con límite, grados y unidad por defecto', async () => {
    const ventaCombustible = {
      findMany: jest.fn().mockResolvedValue([
        {
          idVenta: 7,
          numeroPos: 1,
          numeroBomba: 2,
          numeroManguera: '3',
          numeroGrado: 1,
          precioUnitario: 40,
          volumen: 2.5,
          facturada: false,
          monto: 100,
          fecha: new Date('2026-08-15T08:00:00.000Z'),
          fechaTransaccion: '2026-08-15',
          horaTransaccion: '08:00:00',
        },
      ]),
    };
    const manguera = {
      findMany: jest.fn().mockResolvedValue([
        {
          idBomba: 2,
          numeroGrado: 1,
          nombreGrado: 'SUPER',
          unidadMedida: 'galones',
        },
        {
          idBomba: null,
          numeroGrado: null,
          nombreGrado: '',
          unidadMedida: null,
        },
      ]),
    };
    const repo = new DispenserRepositoryImpl({
      ventaCombustible,
      manguera,
    } as any);

    const txns = await repo.getPumpTransactions(2, 5);

    expect(txns[0]).toMatchObject({
      saleId: 7,
      pumpNumber: 2,
      hoseNumber: '3',
      combustible: 'SUPER',
      unidad: 'galones',
      estado: 'Sin Facturar',
      cantidad: 2.5,
      fecha: '2026-08-15',
      hora: '08:00:00',
    });
  });
});
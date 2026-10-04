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
      expect.anything(),
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
        isInvoiced: true,
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
      ShiftId: null,
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

    expect(mapping).toEqual({ CodigoPOS: 'SUPER', TankIDs: 'T1,T2', unidadMedida: null });
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
        idBomba: 1,
        idMangueraFisica: 1,
        codigoPos: 'SUPER',
        visible: true,
      },
    ]);
    const repo = new DispenserRepositoryImpl({ manguera: { findMany } } as any);

    const hoses = await repo.getHoseConfigs();

    expect(hoses[0].pricePerUnit).toBe(0);
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

  it('updateSaleInvoiced envía clearOnController cuando WAYNE_CLEAR_ON_CONTROLLER está definido', async () => {
    const clear = jest.fn().mockResolvedValue(ok({ success: true }));
    global.fetch = clear;
    const repo = new DispenserRepositoryImpl({} as any);

    const prev = process.env.WAYNE_CLEAR_ON_CONTROLLER;
    try {
      process.env.WAYNE_CLEAR_ON_CONTROLLER = 'false';
      await repo.updateSaleInvoiced('456', '01');

      expect(clear).toHaveBeenCalledWith(
        expect.stringContaining('/api/sales/456/clear'),
        expect.objectContaining({
          body: JSON.stringify({ paymentMethod: 'EFECTIVO', clearOnController: false }),
        }),
      );
    } finally {
      process.env.WAYNE_CLEAR_ON_CONTROLLER = prev;
    }
  });

  it('updateSaleInvoiced envía clearedBy cuando employeeName está presente', async () => {
    const clear = jest.fn().mockResolvedValue(ok({ success: true }));
    global.fetch = clear;
    const repo = new DispenserRepositoryImpl({} as any);

    await repo.updateSaleInvoiced('555', '01', 'JUAN');

    expect(clear).toHaveBeenCalledWith(
      expect.stringContaining('/api/sales/555/clear'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const sentBody = JSON.parse(clear.mock.calls[0][1].body);
    expect(sentBody.clearedBy).toBe('JUAN');
    expect(sentBody.paymentMethod).toBe('EFECTIVO');
  });

  it('updateSaleInvoiced omite llamada al clear si WAYNE_SKIP_CLEAR_SALE es true', async () => {
    const clear = jest.fn().mockResolvedValue(ok({ success: true }));
    global.fetch = clear;
    const repo = new DispenserRepositoryImpl({} as any);

    const prev = process.env.WAYNE_SKIP_CLEAR_SALE;
    try {
      process.env.WAYNE_SKIP_CLEAR_SALE = 'true';
      await repo.updateSaleInvoiced('789', '01');

      expect(clear).not.toHaveBeenCalled();
    } finally {
      process.env.WAYNE_SKIP_CLEAR_SALE = prev;
    }
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
            pos: 'POS01',
          },
        ]),
      },
    } as any);

    const simple = await repo.getSimpleHoseConfigs();
    expect(simple[0]).toEqual({
      pumpId: 1,
      productName: 'SUPER',
      unitPrice: 0,
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
      configuracionPos: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    const total = await repo.countPendingSalesForPos('POS01');

    expect(total).toBe(2);
  });

  it('countPendingSalesForPos devuelve 0 sin bombas o en error', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const empty = new DispenserRepositoryImpl({
      manguera: { findMany: jest.fn().mockResolvedValue([{ idBomba: null }]) },
      configuracionPos: { findFirst: jest.fn().mockResolvedValue(null) },
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

  it('getPumpTransactions mapea desde wayne con grados y unidad', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([
        {
          saleId: 7,
          pumpId: 2,
          hoseId: 3,
          grade: 1,
          volume: 2.5,
          amount: 100,
          ppu: 40,
          dateOfTransaction: '2026-08-15',
          timeOfTransaction: '08:00:00',
          isInvoiced: false,
        },
      ]),
    );
    const manguera = {
      findMany: jest.fn().mockResolvedValue([
        {
          idBomba: 2,
          numeroGrado: 1,
          nombreGrado: 'SUPER',
          unidadMedida: 'galones',
          pos: '1',
        },
      ]),
    };
    const repo = new DispenserRepositoryImpl({ manguera } as any);

    const txns = await repo.getPumpTransactions(2, 5);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sales/pump/2/sales?limit=5'),
      expect.anything(),
    );
    expect(txns[0]).toMatchObject({
      saleId: 7,
      pumpNumber: 2,
      hoseNumber: '3',
      combustible: 'SUPER',
      unidad: 'galones',
      posNumber: 1,
      estado: 'Sin Facturar',
      cantidad: 2.5,
      precio: 40,
      fecha: '2026-08-15',
      hora: '08:00:00',
    });
  });

  it('getPumpTransactions marca Facturado si isInvoiced presente', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([
        {
          saleId: 8,
          pumpId: 2,
          hoseId: 1,
          grade: 1,
          volume: 10,
          amount: 300,
          ppu: 30,
          isInvoiced: true,
        },
      ]),
    );
    const repo = new DispenserRepositoryImpl({ manguera: { findMany: jest.fn().mockResolvedValue([]) } } as any);

    const txns = await repo.getPumpTransactions(2, 5);

    expect(txns[0]).toMatchObject({ estado: 'Facturado' });
  });

  it('getPumpTransactions usa PUMP_TRANSACTIONS_LIMIT por defecto (400)', async () => {
    const orig = process.env.PUMP_TRANSACTIONS_LIMIT;
    delete process.env.PUMP_TRANSACTIONS_LIMIT;
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const repo = new DispenserRepositoryImpl({ manguera: { findMany: jest.fn().mockResolvedValue([]) } } as any);

    await repo.getPumpTransactions(2);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sales/pump/2/sales?limit=400'),
      expect.anything(),
    );
    if (orig !== undefined) process.env.PUMP_TRANSACTIONS_LIMIT = orig;
  });

  it('usa el url_controlador de la tienda como base de wayne', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const repo = new DispenserRepositoryImpl({
      tienda: {
        findFirst: jest.fn().mockResolvedValue({ urlControlador: '192.168.0.10:5008' }),
      },
    } as any);

    await repo.getPendingSales();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://192.168.0.10:5008/api/sales/pending'),
      expect.anything(),
    );
  });

  it('normaliza url_controlador (http:// faltante, / y /api al final)', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const repo = new DispenserRepositoryImpl({
      tienda: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ urlControlador: '192.168.0.10:5008/api/' }),
      },
    } as any);

    await repo.getPendingSales();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://192.168.0.10:5008/api/sales/pending'),
      expect.anything(),
    );
  });

  it('cae a WAYNE_API_URL / localhost si no hay url_controlador', async () => {
    const orig = process.env.WAYNE_API_URL;
    delete process.env.WAYNE_API_URL;
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const repo = new DispenserRepositoryImpl({
      tienda: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await repo.getPendingSales();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:5008/api/sales/pending'),
      expect.anything(),
    );
    if (orig !== undefined) process.env.WAYNE_API_URL = orig;
  });

  it('envía X-API-Key desde clave_controlador de la tienda', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const repo = new DispenserRepositoryImpl({
      tienda: {
        findFirst: jest.fn().mockResolvedValue({
          urlControlador: '127.0.0.1:5008',
          claveControlador: 'MI-KEY-123',
        }),
      },
    } as any);

    await repo.getPendingSales();

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const headers = new Headers(call[1].headers);
    expect(headers.get('X-API-Key')).toBe('MI-KEY-123');
  });

  it('no envía X-API-Key si no hay clave configurada', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok([]));
    const repo = new DispenserRepositoryImpl({
      tienda: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await repo.getPendingSales();

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const headers = new Headers(call[1].headers);
    expect(headers.get('X-API-Key')).toBeNull();
  });

  it('restartControlador llama a wayne y mapea el resultado', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({
        message: 'Service will restart in 2 seconds (NSSM auto-restart required).',
        restartAt: '2026-09-12T00:00:00Z',
        cooldownSeconds: 60,
      }),
    );
    const repo = new DispenserRepositoryImpl({} as any);

    const result = await repo.restartControlador();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/restart?delaySeconds=2'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.message).toContain('restart in 2 seconds');
    expect(result.cooldownSeconds).toBe(60);
  });

  it('restartControlador lanza error claro si wayne falla', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Restart en cooldown' }),
      } as Response),
    );
    const repo = new DispenserRepositoryImpl({} as any);

    await expect(repo.restartControlador()).rejects.toThrow(/429/);
  });
});
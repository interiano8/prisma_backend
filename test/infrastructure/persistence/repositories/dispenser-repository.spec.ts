import { DispenserRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/dispenser-repository';

describe('DispenserRepositoryImpl', () => {
  it('getPendingSales devuelve las ventas sin facturar mapeadas', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        idVenta: 1,
        numeroBomba: 3,
        monto: 500,
        precioUnitario: 30.5,
        volumen: 16.39,
        numeroGrado: 1,
        facturada: false,
      },
    ]);
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { findMany },
    } as any);

    const sales = await repo.getPendingSales();

    expect(findMany).toHaveBeenCalledWith({ where: { facturada: false } });
    expect(sales[0]).toEqual(
      expect.objectContaining({ SaleID: 1, PumpNumber: 3, IsInvoiced: false }),
    );
  });

  it('getSaleById devuelve null si no existe', async () => {
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);
    await expect(repo.getSaleById(999)).resolves.toBeNull();
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

  it('updateSaleInvoiced marca la venta como facturada', async () => {
    const update = jest.fn().mockResolvedValue({});
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { update },
    } as any);

    await repo.updateSaleInvoiced('123', '01');

    expect(update).toHaveBeenCalledWith({
      where: { idVenta: 123 },
      data: { facturada: true, numeroPos: 1 },
    });
  });

  it('renewTransactions actualiza la fecha de las pendientes y devuelve el conteo', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 5 });
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { updateMany },
    } as any);

    const count = await repo.renewTransactions();

    expect(count).toBe(5);
    expect(updateMany).toHaveBeenCalledWith({
      where: { facturada: false },
      data: { fecha: expect.any(Date) },
    });
  });

  it('getHoseFsForPos devuelve los PumpID distintos', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ idBomba: 1 }, { idBomba: 2 }]);
    const repo = new DispenserRepositoryImpl({ manguera: { findMany } } as any);

    const pumps = await repo.getHoseFsForPos('01');

    expect(pumps).toEqual([{ PumpID: 1 }, { PumpID: 2 }]);
  });

  it('getPendingSales devuelve [] si falla la consulta', async () => {
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    } as any);

    await expect(repo.getPendingSales()).resolves.toEqual([]);
  });

  it('getSaleById mapea todos los campos', async () => {
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: {
        findUnique: jest.fn().mockResolvedValue({
          idVenta: 5,
          numeroBomba: 2,
          numeroManguera: '3',
          monto: 100,
          precioUnitario: 40,
          volumen: 2.5,
          numeroGrado: 1,
          facturada: true,
        }),
      },
    } as any);

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

    const ok = new DispenserRepositoryImpl({
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

    const hoses = await ok.getHoseConfigs();
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

    expect(ventaCombustible.findMany).toHaveBeenCalledWith({
      where: { numeroBomba: 2 },
      orderBy: { idVenta: 'desc' },
      take: 5,
    });
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

  it('getPumpTransactions sin límite y con grado desconocido', async () => {
    const ventaCombustible = {
      findMany: jest.fn().mockResolvedValue([
        {
          idVenta: 8,
          numeroPos: null,
          numeroBomba: null,
          numeroManguera: null,
          numeroGrado: 99,
          precioUnitario: 0,
          volumen: 0,
          facturada: true,
          monto: 0,
          fecha: null,
        },
      ]),
    };
    const repo = new DispenserRepositoryImpl({
      ventaCombustible,
      manguera: { findMany: jest.fn().mockResolvedValue([]) },
    } as any);

    const txns = await repo.getPumpTransactions(2);

    expect(ventaCombustible.findMany).toHaveBeenCalledWith({
      where: { numeroBomba: 2 },
      orderBy: { idVenta: 'desc' },
    });
    expect(txns[0]).toMatchObject({
      posNumber: 0,
      pumpNumber: 0,
      hoseNumber: '',
      grade: '99',
      combustible: '',
      estado: 'Facturado',
      date: '',
      despachador: '',
    });
  });

  it('getPumpTransactions devuelve [] en error', async () => {
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    } as any);

    await expect(repo.getPumpTransactions(2)).resolves.toEqual([]);
  });

  it('updateSaleInvoiced reintenta hasta 3 veces y lanza al final', async () => {
    jest.useFakeTimers();
    const update = jest
      .fn()
      .mockRejectedValueOnce(new Error('lock'))
      .mockResolvedValueOnce({});
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { update },
    } as any);

    const promise = repo.updateSaleInvoiced('123', '01');
    await jest.advanceTimersByTimeAsync(500);

    await promise;
    expect(update).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('updateSaleInvoiced lanza tras agotar los reintentos', async () => {
    jest.useFakeTimers();
    const update = jest.fn().mockRejectedValue(new Error('db down'));
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { update },
    } as any);

    const promise = repo.updateSaleInvoiced('123', '01');
    const assertion = expect(promise).rejects.toThrow('db down');
    await jest.advanceTimersByTimeAsync(1500);

    await assertion;
    expect(update).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('reverseFusionSale desmarca facturada y traga errores', async () => {
    const update = jest.fn().mockResolvedValue({});
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { update },
    } as any);

    await repo.reverseFusionSale('7');
    expect(update).toHaveBeenCalledWith({
      where: { idVenta: 7 },
      data: { facturada: false },
    });

    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const failing = new DispenserRepositoryImpl({
      ventaCombustible: { update: jest.fn().mockRejectedValue(new Error('x')) },
    } as any);
    await failing.reverseFusionSale('8');
    expect(warn).toHaveBeenCalled();
  });

  it('renewTransactions re-lanza el error de base', async () => {
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: {
        updateMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    } as any);

    await expect(repo.renewTransactions()).rejects.toThrow('db down');
  });

  it('getHoseFsForPos devuelve [] en error', async () => {
    const repo = new DispenserRepositoryImpl({
      manguera: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
    } as any);

    await expect(repo.getHoseFsForPos('01')).resolves.toEqual([]);
  });

  it('countPendingSalesForPos cuenta solo las bombas del POS', async () => {
    const manguera = jest
      .fn()
      .mockResolvedValue([{ idBomba: 1 }, { idBomba: null }, { idBomba: 2 }]);
    const count = jest.fn().mockResolvedValue(3);
    const repo = new DispenserRepositoryImpl({
      manguera: { findMany: manguera },
      ventaCombustible: { count },
    } as any);

    const total = await repo.countPendingSalesForPos('POS01');

    expect(total).toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: { facturada: false, numeroBomba: { in: [1, 2] } },
    });
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

  it('getExistingSaleIds devuelve solo los ids', async () => {
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: {
        findMany: jest.fn().mockResolvedValue([{ idVenta: 1 }, { idVenta: 2 }]),
      },
    } as any);

    await expect(repo.getExistingSaleIds()).resolves.toEqual([1, 2]);
  });

  it('createSales devuelve 0 sin datos y parte en lotes de 1000', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const repo = new DispenserRepositoryImpl({
      ventaCombustible: { createMany },
    } as any);

    await expect(repo.createSales([])).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();

    const data = Array.from({ length: 1500 }, (_, i) => ({
      idVenta: i,
      numeroPos: null,
      numeroBomba: null,
      numeroManguera: null,
      monto: null,
      precioUnitario: null,
      volumen: null,
      volumenFinal: null,
      volumenInicial: null,
      tipoPago: null,
      infoPago: null,
      temperaturaCompensada: null,
      idTurno: null,
      numeroGrado: null,
      nivelPrecio: null,
      tipoTransaccion: null,
      fechaTransaccion: null,
      horaTransaccion: null,
      montoPreestablecido: null,
      alarmaPago: null,
      atcvo: null,
      avgtm: null,
      atcivo: null,
      atcfvo: null,
      facturada: false,
      fecha: null,
    }));
    const count = await repo.createSales(data);

    expect(count).toBe(1500);
    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany.mock.calls[0][0].data).toHaveLength(1000);
    expect(createMany.mock.calls[1][0].data).toHaveLength(500);
    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });
});

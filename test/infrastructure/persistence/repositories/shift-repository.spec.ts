import { ShiftRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/shift-repository';

describe('ShiftRepositoryImpl', () => {
  const openShiftRow = {
    idTransaccionPos: 'TX001',
    idTienda: '001',
    codigoPos: '01',
    turno: '1',
    inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
    finTurno: null,
    importeContado: 0,
    nombreEmpleado: 'prueba',
    montoInicial: 500,
    posCierre: null,
  };

  it('findOpenShift devuelve el turno abierto mapeado', async () => {
    const findFirst = jest.fn().mockResolvedValue(openShiftRow);
    const repo = new ShiftRepositoryImpl({ turno: { findFirst } } as any);

    const shift = await repo.findOpenShift('001', '01', 'prueba');

    expect(shift).not.toBeNull();
    expect(shift!.shiftNumber).toBe('1');
    expect(shift!.posTransactionId).toBe('TX001');
    expect(shift!.isOpen).toBe(true);
    expect(shift!.initialAmount).toBe(500);
    expect(shift!.posCierre).toBeNull();
  });

  it('findOpenShift devuelve null si no hay turno abierto', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.findOpenShift('001', '01', 'prueba')).resolves.toBeNull();
  });

  it('closeShift cierra el turno y guarda el POS de cierre', async () => {
    const tx = {
      turno: { update: jest.fn().mockResolvedValue({}) },
      registroTransaccion: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      turno: { findFirst: jest.fn().mockResolvedValue(openShiftRow) },
      registroTransaccion: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ idTransaccionPos: 'TX001' }]),
      },
      venta: {
        findMany: jest.fn().mockResolvedValue([{ monto: 100 }]),
      },
      pagoVenta: {
        findMany: jest.fn().mockResolvedValue([
          { codigoMetodoPago: '1007', monto: 100 },
        ]),
      },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    } as any;
    const repo = new ShiftRepositoryImpl(prisma);

    const result = await repo.closeShift({
      storeId: '001',
      posNo: '02',
      employeeName: 'prueba',
      actualAmount: 0,
    });

    expect(result).toEqual({ success: true });
    expect(tx.turno.update).toHaveBeenCalledWith({
      where: { idTransaccionPos: 'TX001' },
      data: expect.objectContaining({
        posCierre: '02',
        importeContado: 100,
        detallePagos: { '1007': 100 },
      }),
    });
    expect(tx.registroTransaccion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: true } }),
    );
    expect(tx.registroTransaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idTransaccionPos: 'TX001',
          tipoTransaccion: 4,
          estado: true,
        }),
      }),
    );
    expect(prisma.registroTransaccion.findMany).toHaveBeenCalledWith({
      where: {
        numeroTurno: '1',
        fechaTurno: { gte: expect.any(Date), lte: expect.any(Date) },
        tipoTransaccion: { in: [1, 2, 3] },
      },
      select: { idTransaccionPos: true },
    });
    expect(prisma.venta.findMany).toHaveBeenCalledWith({
      where: { idTransaccionPos: { in: ['TX001'] }, tipoFacturacion: 1 },
      select: { monto: true },
    });
    expect(prisma.pagoVenta.findMany).toHaveBeenCalledWith({
      where: { idTransaccionPos: { in: ['TX001'] } },
      select: { codigoMetodoPago: true, monto: true },
    });
  });

  it('closeShift lanza error si no hay turno abierto', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(
      repo.closeShift({
        storeId: '001',
        posNo: '02',
        employeeName: 'prueba',
        actualAmount: 0,
      }),
    ).rejects.toThrow('No hay turno abierto para cerrar.');
  });

  it('findOpenShiftFromDb devuelve Message cuando no hay turno', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    const result = await repo.findOpenShiftFromDb('001', '01', 'prueba');

    expect(result).toEqual({ Message: 'No open shift found', Shift: null });
  });

  it('findOpenShiftFromDb mapea el turno abierto', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: {
        findFirst: jest.fn().mockResolvedValue({
          turno: 3,
          idTransaccionPos: 'TX002',
          inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
        }),
      },
    } as any);

    const result = await repo.findOpenShiftFromDb('001', '01', 'prueba');

    expect(result).toMatchObject({
      Shift: '3',
      'POS Transaction ID': 'TX002',
    });
    expect(result['Shift Starting']).toContain('2026-08-15');
  });

  it('getOpenShiftByEmployee devuelve Message cuando no hay turno', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    const result = await repo.getOpenShiftByEmployee('001', 'prueba');

    expect(result).toEqual({ Message: 'No open shift found', Shift: null });
  });

  it('getOpenShiftByEmployee mapea el turno con monto inicial', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: {
        findFirst: jest.fn().mockResolvedValue({
          turno: '2',
          idTransaccionPos: 'TX003',
          inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
          montoInicial: 700,
          nombreEmpleado: 'prueba',
        }),
      },
    } as any);

    const result = await repo.getOpenShiftByEmployee('001', 'prueba');

    expect(result).toMatchObject({
      Shift: '2',
      MontoInicial: 700,
      EmployeeName: 'prueba',
    });
  });

  describe('createShift', () => {
    const trSeries = {
      codigoSerie: 'TR-ID',
      numeroLinea: 1,
      ultimoNumeroUsado: '00000100000000001',
      idTienda: '001',
      codigoPos: '01',
    };

    it('crea turno con número autogenerado y correlativo TR-ID', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([trSeries]),
        turno: { create: jest.fn().mockResolvedValue(openShiftRow) },
        serieDocumento: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const prisma = {
        tienda: { findUnique: jest.fn().mockResolvedValue({ turnos: 99 }) },
        turno: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null) // existing shift today
            .mockResolvedValueOnce(null) // open shift
            .mockResolvedValueOnce({ turno: '1A' }), // last shift no numérico puro
        },
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new ShiftRepositoryImpl(prisma);

      const result = await repo.createShift({
        storeId: '001',
        posNo: '01',
        employeeName: 'prueba',
        initialAmount: 500,
      });

      expect(tx.turno.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idTransaccionPos: '00000100000000002',
          turno: '1',
          importeContado: 500,
        }),
      });
      expect(tx.serieDocumento.updateMany).toHaveBeenCalled();
      expect(result.shiftNumber).toBe('1');
    });

    it('rechaza si supera el máximo de turnos de la tienda', async () => {
      const prisma = {
        tienda: { findUnique: jest.fn().mockResolvedValue({ turnos: 1 }) },
        turno: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ turno: '1' }) // last shift -> next = 2
            .mockResolvedValueOnce(null), // open shift
        },
      } as any;
      const repo = new ShiftRepositoryImpl(prisma);

      await expect(
        repo.createShift({
          storeId: '001',
          posNo: '01',
          employeeName: 'prueba',
          initialAmount: 500,
        }),
      ).rejects.toThrow('No se permite crear más de 1 turnos');
    });

    it('crea turno sin límite si la tienda no define turnos (0)', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([trSeries]),
        turno: { create: jest.fn().mockResolvedValue(openShiftRow) },
        serieDocumento: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const prisma = {
        tienda: { findUnique: jest.fn().mockResolvedValue({ turnos: 0 }) },
        turno: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ turno: '1A' }) // last shift no numérico puro
            .mockResolvedValueOnce(null), // open shift
        },
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new ShiftRepositoryImpl(prisma);

      const result = await repo.createShift({
        storeId: '001',
        posNo: '01',
        employeeName: 'prueba',
        initialAmount: 500,
      });

      expect(tx.turno.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ turno: '1' }),
      });
      expect(result.shiftNumber).toBe('1');
    });

    it('rechaza si el turno ya fue creado hoy', async () => {
      const prisma = {
        tienda: { findUnique: jest.fn().mockResolvedValue({ turnos: 99 }) },
        turno: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ turno: '5' }) // existing today
            .mockResolvedValueOnce(null),
        },
      } as any;
      const repo = new ShiftRepositoryImpl(prisma);

      await expect(
        repo.createShift({
          storeId: '001',
          posNo: '01',
          employeeName: 'prueba',
          shiftNumber: 5,
          initialAmount: 0,
        }),
      ).rejects.toThrow('El turno 5 ya fue creado');
    });

    it('rechaza si ya hay un turno abierto', async () => {
      const prisma = {
        tienda: { findUnique: jest.fn().mockResolvedValue({ turnos: 99 }) },
        turno: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(openShiftRow),
        },
      } as any;
      const repo = new ShiftRepositoryImpl(prisma);

      await expect(
        repo.createShift({
          storeId: '001',
          posNo: '01',
          employeeName: 'prueba',
          initialAmount: 0,
        }),
      ).rejects.toThrow('Ya hay un turno abierto');
    });

    it('lanza si no hay serie TR-ID', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      const prisma = {
        tienda: { findUnique: jest.fn().mockResolvedValue({ turnos: 99 }) },
        turno: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null),
        },
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new ShiftRepositoryImpl(prisma);

      await expect(
        repo.createShift({
          storeId: '001',
          posNo: '01',
          employeeName: 'prueba',
          initialAmount: 0,
        }),
      ).rejects.toThrow('No se pudo obtener el número de transacción.');
    });
  });

  it('countTurnoControladorByPeriod y createTurnoControlador', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const create = jest.fn().mockResolvedValue({});
    const repo = new ShiftRepositoryImpl({
      turnoControlador: { count, create },
    } as any);

    await expect(repo.countTurnoControladorByPeriod('P1')).resolves.toBe(2);
    await repo.createTurnoControlador({
      periodId: 'P1',
      startDate: '2026-08-15',
      startTime: '06:00',
      additionalDetails: '[]',
    });

    expect(count).toHaveBeenCalledWith({ where: { periodId: 'P1' } });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        periodId: 'P1',
        startDate: '2026-08-15',
      }),
    });
  });

  it('getAvailableShifts mapea registros distintos', async () => {
    const repo = new ShiftRepositoryImpl({
      registroTransaccion: {
        findMany: jest.fn().mockResolvedValue([
          { numeroTurno: '1', codigoPos: '01', nombreEmpleado: 'A' },
          { numeroTurno: '2', codigoPos: '02', nombreEmpleado: 'B' },
        ]),
      },
    } as any);

    const result = await repo.getAvailableShifts('001', '2026-08-15');

    expect(result).toEqual([
      { Turno: '1', PosCode: '01', Cajero: 'A' },
      { Turno: '2', PosCode: '02', Cajero: 'B' },
    ]);
    expect(
      repo['prisma'].registroTransaccion.findMany,
    ).toHaveBeenCalledWith({
      where: {
        idTienda: '001',
        fechaTurno: {
          gte: new Date('2026-08-15T00:00:00'),
          lte: new Date('2026-08-15T23:59:59'),
        },
      },
      distinct: ['numeroTurno', 'codigoPos', 'nombreEmpleado'],
      select: { numeroTurno: true, codigoPos: true, nombreEmpleado: true },
    });
  });

  it('getSalesReportData devuelve vacíos si no hay transacciones', async () => {
    const repo = new ShiftRepositoryImpl({
      registroTransaccion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      lineaVenta: { findMany: jest.fn() },
      pagoVenta: { findMany: jest.fn() },
      venta: { findMany: jest.fn() },
    } as any);

    const result = await repo.getSalesReportData(
      '001',
      '1',
      'prueba',
      '2026-08-15',
    );

    expect(result).toEqual({ lines: [], payments: [], headers: [] });
  });

  it('getSalesReportData consulta líneas, pagos y ventas', async () => {
    const repo = new ShiftRepositoryImpl({
      registroTransaccion: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { idTransaccionPos: 'T1' },
            { idTransaccionPos: 'T1' },
          ]),
      },
      lineaVenta: {
        findMany: jest.fn().mockResolvedValue([
          {
            numeroBomba: '01',
            descripcion: 'GAS',
            montoConIsv: 100,
            grupoIsv: 'EXENTO',
            montoIsv: 0,
            montoDescuentoLinea: 5,
            cantidad: 10,
          },
        ]),
      },
      pagoVenta: {
        findMany: jest.fn().mockResolvedValue([
          {
            descripcion: 'EFECTIVO',
            codigoMetodoPago: '1002',
            monto: 100,
            montoIngresado: 100,
          },
        ]),
      },
      metodoPago: {
        findMany: jest.fn().mockResolvedValue([
          { codigo: '1002', descripcion: 'EFECTIVO' },
        ]),
      },
      venta: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ monto: 100, tipoDocumento: 1 }]),
      },
    } as any);

    const result = await repo.getSalesReportData(
      '001',
      '1',
      'prueba',
      '2026-08-15',
    );

    expect(result.lines).toEqual([
      {
        numeroBomba: '01',
        descripcion: 'GAS',
        montoConIsv: 100,
        grupoIsv: 'EXENTO',
        montoIsv: 0,
        montoDescuentoLinea: 5,
        cantidad: 10,
        unidadMedida: null,
      },
    ]);
    expect(result.payments).toEqual([
      {
        descripcion: 'EFECTIVO',
        codigoMetodoPago: '1002',
        metodoPago: 'EFECTIVO',
        monto: 100,
        montoIngresado: 100,
      },
    ]);
    expect(result.headers).toEqual([{ monto: 100, tipoDocumento: 1 }]);
    expect(
      repo['prisma'].lineaVenta.findMany,
    ).toHaveBeenCalledWith({ where: { idTransaccionPos: { in: ['T1'] } } });
    expect(
      repo['prisma'].pagoVenta.findMany,
    ).toHaveBeenCalledWith({ where: { idTransaccionPos: { in: ['T1'] } } });
    expect(
      repo['prisma'].venta.findMany,
    ).toHaveBeenCalledWith({ where: { idTransaccionPos: { in: ['T1'] } } });
    expect(repo['prisma'].registroTransaccion.findMany).toHaveBeenCalledWith({
      where: {
        idTienda: '001',
        numeroTurno: '1',
        nombreEmpleado: 'prueba',
        fechaTurno: { gte: new Date('2026-08-15T00:00:00'), lte: new Date('2026-08-15T23:59:59') },
      },
      select: { idTransaccionPos: true },
    });
  });

  it('findOpenShiftFromDb aplica defaults con turno nulo y sin id', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: {
        findFirst: jest.fn().mockResolvedValue({
          turno: null,
          idTransaccionPos: '',
          inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
        }),
      },
    } as any);

    const result = await repo.findOpenShiftFromDb('001', '01', 'prueba');

    expect(result).toMatchObject({
      Shift: '1',
      'POS Transaction ID': 'TX-DEFAULT',
    });
  });

  it('getOpenShiftByEmployee aplica defaults con turno nulo', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: {
        findFirst: jest.fn().mockResolvedValue({
          turno: null,
          idTransaccionPos: '',
          inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
          montoInicial: null,
          nombreEmpleado: null,
        }),
      },
    } as any);

    const result = await repo.getOpenShiftByEmployee('001', 'prueba');

    expect(result).toMatchObject({
      Shift: '1',
      'POS Transaction ID': 'TX-DEFAULT',
      MontoInicial: 0,
    });
  });

  it('closeShift tolera turno nulo en el número de turno', async () => {
    const tx = {
      turno: { update: jest.fn().mockResolvedValue({}) },
      registroTransaccion: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      turno: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...openShiftRow, turno: null }),
      },
      registroTransaccion: { findMany: jest.fn().mockResolvedValue([]) },
      venta: { findMany: jest.fn().mockResolvedValue([]) },
      pagoVenta: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    } as any;
    const repo = new ShiftRepositoryImpl(prisma);

    await repo.closeShift({
      storeId: '001',
      posNo: '02',
      employeeName: 'prueba',
      actualAmount: 0,
    });

    expect(tx.registroTransaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numeroTurno: '' }),
      }),
    );
  });

  it('mapShift aplica defaults con campos nulos', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: {
        findFirst: jest.fn().mockResolvedValue({
          idTransaccionPos: 'TX',
          idTienda: null,
          codigoPos: null,
          turno: null,
          inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
          finTurno: null,
          nombreEmpleado: null,
          montoInicial: null,
          posCierre: null,
        }),
      },
    } as any);

    const shift = await repo.findOpenShift('001', '01');

    expect(shift).toMatchObject({
      shiftNumber: '',
      storeId: '',
      posNo: '',
      employeeName: '',
      initialAmount: 0,
      isOpen: true,
    });
  });

  it('mapShift marca isOpen false cuando hay finTurno', async () => {
    const repo = new ShiftRepositoryImpl({
      turno: {
        findFirst: jest.fn().mockResolvedValue({
          idTransaccionPos: 'TX',
          idTienda: '001',
          codigoPos: '01',
          turno: '3',
          inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
          finTurno: new Date('2026-08-15T16:00:00.000Z'),
          nombreEmpleado: 'Ana',
          montoInicial: 500,
          posCierre: '02',
        }),
      },
    } as any);

    const shift = await repo.findOpenShift('001', '01');

    expect(shift?.isOpen).toBe(false);
  });

  it('findOpenShift incluye nombreEmpleado solo si se provee', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repo = new ShiftRepositoryImpl({ turno: { findFirst } } as any);

    await repo.findOpenShift('001', '01');

    expect(findFirst).toHaveBeenCalledWith({
      where: { idTienda: '001', finTurno: null },
      orderBy: { inicioTurno: 'desc' },
    });
  });

  it('findOpenShift incluye nombreEmpleado cuando se provee', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repo = new ShiftRepositoryImpl({ turno: { findFirst } } as any);

    await repo.findOpenShift('001', '01', 'Ana');

    expect(findFirst).toHaveBeenCalledWith({
      where: { idTienda: '001', nombreEmpleado: 'Ana', finTurno: null },
      orderBy: { inicioTurno: 'desc' },
    });
  });

  it('findOpenShiftFromDb consulta con todos los filtros', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repo = new ShiftRepositoryImpl({ turno: { findFirst } } as any);

    await repo.findOpenShiftFromDb('001', '01', 'Ana');

    expect(findFirst).toHaveBeenCalledWith({
      where: { idTienda: '001', nombreEmpleado: 'Ana', finTurno: null },
      orderBy: { inicioTurno: 'desc' },
    });
  });
});

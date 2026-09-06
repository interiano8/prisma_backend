import { BadRequestDomainError } from '../../src/domain/errors/domain-error';
import { Test } from '@nestjs/testing';
import { ShiftService } from '../../src/application/services/shift.service';
import type { ShiftRepository } from '../../src/domain/ports/out/shift-repository.interface';
import type { StoreConfigRepository } from '../../src/domain/ports/out/store-config-repository.interface';
import type { DispenserRepository } from '../../src/domain/ports/out/dispenser-repository.interface';

const response = (data: unknown) => ({ json: () => data }) as Response;

describe('ShiftService', () => {
  let service: ShiftService;
  let shiftRepo: jest.Mocked<ShiftRepository>;
  let storeConfigRepo: jest.Mocked<StoreConfigRepository>;
  let dispenserRepo: jest.Mocked<DispenserRepository>;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    shiftRepo = {
      countTurnoControladorByPeriod: jest.fn(),
      createTurnoControlador: jest.fn(),
      getAvailableShifts: jest.fn(),
      getSalesReportData: jest.fn(),
      findOpenShift: jest.fn(),
      findOpenShiftFromDb: jest.fn(),
      getOpenShiftByEmployee: jest.fn(),
      createShift: jest.fn(),
      closeShift: jest.fn(),
    };
    storeConfigRepo = {
      findByStoreId: jest.fn(),
      update: jest.fn(),
      findBlockedForPendingTransactions: jest.fn(),
      findHideShiftInfo: jest.fn(),
      findExchangeRate: jest.fn(),
      findTasaByGrupo: jest.fn().mockResolvedValue(0),
    };
    dispenserRepo = {
      countPendingSalesForPos: jest.fn(),
    } as unknown as jest.Mocked<DispenserRepository>;

    const module = await Test.createTestingModule({
      providers: [
        ShiftService,
        { provide: 'ShiftRepository', useValue: shiftRepo },
        { provide: 'StoreConfigRepository', useValue: storeConfigRepo },
        { provide: 'DispenserRepository', useValue: dispenserRepo },
      ],
    }).compile();

    service = module.get(ShiftService);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('closeFusionShift', () => {
    it('normaliza storeId numérico a 3 dígitos y cierra con tipo por defecto S', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock.mockResolvedValue(response({ success: true }));

      const result = await service.closeFusionShift({
        storeId: '1',
        posNo: 'POS01',
        employeeName: 'John',
        actualAmount: 0,
      });

      expect(
        storeConfigRepo.findBlockedForPendingTransactions,
      ).toHaveBeenCalledWith('001');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://fusion.local/api/fusion/shift-close',
        expect.objectContaining({ body: JSON.stringify({ Type: 'S' }) }),
      );
      expect(result).toEqual({ success: true });
    });

    it('rechaza si hay transacciones sin facturar en un bloqueo', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(true);
      dispenserRepo.countPendingSalesForPos.mockResolvedValue(3);

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).rejects.toThrow('Existen 3 transacciones sin facturar.');
    });

    it('continúa si hay bloqueo pero no transacciones pendientes', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(true);
      dispenserRepo.countPendingSalesForPos.mockResolvedValue(0);
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock.mockResolvedValue(response({ success: true }));

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).resolves.toEqual({ success: true });
    });

    it('lanza si la tienda no tiene URL de Fusion', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue(null);

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).rejects.toThrow(BadRequestDomainError);
    });

    it('normaliza URL sin protocolo, con barra final y sufijo /api', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'fusion.local/api/',
      } as never);
      fetchMock.mockResolvedValue(response({ success: true }));

      await service.closeFusionShift({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        actualAmount: 0,
        type: 'X',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://fusion.local/api/fusion/shift-close',
        expect.objectContaining({ body: JSON.stringify({ Type: 'X' }) }),
      );
    });

    it('lanza si Fusion devuelve errorCode', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock.mockResolvedValue(
        response({ errorCode: 'E1', message: 'boom' }),
      );

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).rejects.toThrow('Error al cerrar en Fusion: boom');
    });

    it('lanza si el mensaje de Fusion contiene error', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock.mockResolvedValue(response({ message: 'ERROR: something' }));

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).rejects.toThrow('Error al cerrar en Fusion: ERROR: something');
    });

    it('lanza si Fusion devuelve solo errorCode sin message', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock.mockResolvedValue(response({ errorCode: 'E42' }));

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).rejects.toThrow('Error al cerrar en Fusion: E42');
    });

    it('traduce errores de red al cerrar el turno', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).rejects.toThrow(
        'Error de comunicación con Controlador Fusion al cerrar el turno.',
      );
    });

    it('crea turno controlador cuando no existe para el periodo', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock
        .mockResolvedValueOnce(response({ success: true }))
        .mockResolvedValueOnce(
          response({
            PeriodDetails: {
              PeriodID: 42,
              StartDate: '2026-08-15',
              StartTime: '06:00',
              AdditionalDetails: [{ a: 1 }],
            },
          }),
        );
      shiftRepo.countTurnoControladorByPeriod.mockResolvedValue(0);

      await service.closeFusionShift({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        actualAmount: 0,
      });

      expect(shiftRepo.countTurnoControladorByPeriod).toHaveBeenCalledWith(
        '42',
      );
      expect(shiftRepo.createTurnoControlador).toHaveBeenCalledWith({
        periodId: '42',
        startDate: '2026-08-15',
        startTime: '06:00',
        additionalDetails: JSON.stringify([{ a: 1 }]),
      });
    });

    it('no duplica el turno si ya existe', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock
        .mockResolvedValueOnce(response({ success: true }))
        .mockResolvedValueOnce(response({ PeriodDetails: { PeriodID: '7' } }));
      shiftRepo.countTurnoControladorByPeriod.mockResolvedValue(1);

      await service.closeFusionShift({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        actualAmount: 0,
      });

      expect(shiftRepo.createTurnoControlador).not.toHaveBeenCalled();
    });

    it('ignora errores de base de datos en PeriodDetails y sigue', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      fetchMock
        .mockResolvedValueOnce(response({ success: true }))
        .mockResolvedValueOnce(response({ PeriodDetails: { PeriodID: '7' } }));
      shiftRepo.countTurnoControladorByPeriod.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.closeFusionShift({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          actualAmount: 0,
        }),
      ).resolves.toEqual({ success: true });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('no consulta PeriodDetails si no viene PeriodID', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock
        .mockResolvedValueOnce(response({ success: true }))
        .mockResolvedValueOnce(response({}));

      await service.closeFusionShift({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        actualAmount: 0,
      });

      expect(shiftRepo.countTurnoControladorByPeriod).not.toHaveBeenCalled();
    });

    it('usa defaults para StartDate/StartTime/AdditionalDetails ausentes', async () => {
      storeConfigRepo.findBlockedForPendingTransactions.mockResolvedValue(
        false,
      );
      storeConfigRepo.findByStoreId.mockResolvedValue({
        api: 'http://fusion.local',
      } as never);
      fetchMock
        .mockResolvedValueOnce(response({ success: true }))
        .mockResolvedValueOnce(response({ PeriodDetails: { PeriodID: 9 } }));
      shiftRepo.countTurnoControladorByPeriod.mockResolvedValue(0);

      await service.closeFusionShift({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        actualAmount: 0,
      });

      expect(shiftRepo.createTurnoControlador).toHaveBeenCalledWith({
        periodId: '9',
        startDate: '',
        startTime: '',
        additionalDetails: '[]',
      });
    });
  });

  describe('getAvailableShifts', () => {
    it('delega en el repositorio', async () => {
      shiftRepo.getAvailableShifts.mockResolvedValue([
        { Turno: '1', PosCode: 'POS01', Cajero: 'John' },
      ]);

      const result = await service.getAvailableShifts(
        '001',
        'POS01',
        '2026-08-15',
      );

      expect(shiftRepo.getAvailableShifts).toHaveBeenCalledWith(
        '001',
        '2026-08-15',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getShiftSalesReport', () => {
    const baseLine = {
      numeroBomba: '01',
      descripcion: 'Diesel',
      montoConIsv: 100,
      montoIsv: 15,
      grupoIsv: 'IVA',
      montoDescuentoLinea: 5,
    };
    const basePayment = {
      descripcion: 'EFECTIVO',
      codigoMetodoPago: 'CASH',
      monto: 90,
      montoIngresado: 0,
    };
    const baseHeader = { monto: 100, tipoDocumento: 1 };

    const build = (obj: object) => ({ ...obj }) as never;

    it('agrega totales por tipo de documento y agrupa combustibles', async () => {
      storeConfigRepo.findHideShiftInfo.mockResolvedValue(false);
      storeConfigRepo.findExchangeRate.mockResolvedValue(24.5);
      shiftRepo.getSalesReportData.mockResolvedValue({
        lines: [
          build({ ...baseLine, numeroBomba: '01' }),
          build({ ...baseLine, numeroBomba: '01', montoConIsv: 50 }),
          build({ ...baseLine, numeroBomba: '', montoConIsv: 20 }),
        ],
        payments: [
          build({ ...basePayment, monto: 60 }),
          build({
            ...basePayment,
            descripcion: 'TARJETA',
            montoIngresado: 100,
          }),
        ],
        headers: [
          build({ ...baseHeader }),
          build({ ...baseHeader, tipoDocumento: 3 }),
          build({ ...baseHeader, tipoDocumento: 2 }),
        ],
      });

      const result = await service.getShiftSalesReport(
        '001',
        'POS01',
        'John',
        '1',
        '2026-08-15',
      );

      expect(result.shouldHideData).toBe(false);
      expect(result.tasaCambio).toBe(24.5);
      expect(result.combustibles).toEqual([{ name: 'Diesel', total: 150, cantidad: 0 }]);
      expect(result.otrosProductos).toEqual([{ name: 'Diesel', total: 20, cantidad: 0 }]);
      expect(result.dispensadores).toEqual([{ PumpNo: '01' }]);
      expect(result.totales).toMatchObject({
        totalCombustible: 150,
        totalOtrosProductos: 20,
        totalVentas: 300,
        totalCobros: 150,
        totalEfectivo: 60,
        totalDescuentos: 15,
        cantidadFacturas: 1,
        cantidadTicket: 1,
        cantidadDevoluciones: 1,
      });
      expect(result.movCaja).toEqual(
        expect.arrayContaining([{ name: 'TARJETA', total: 100, cantidad: 0 }]),
      );
    });

    it('deduplica dispensadores y esconde datos según config', async () => {
      storeConfigRepo.findHideShiftInfo.mockResolvedValue(true);
      storeConfigRepo.findExchangeRate.mockResolvedValue(0);
      shiftRepo.getSalesReportData.mockResolvedValue({
        lines: [
          build({ ...baseLine, numeroBomba: '01' }),
          build({ ...baseLine, numeroBomba: '02' }),
          build({ ...baseLine, numeroBomba: '01' }),
        ],
        payments: [],
        headers: [],
      });

      const result = await service.getShiftSalesReport(
        '001',
        'POS01',
        'John',
        '1',
        '2026-08-15',
      );

      expect(result.shouldHideData).toBe(true);
      expect(result.dispensadores).toEqual([
        { PumpNo: '01' },
        { PumpNo: '02' },
      ]);
      expect(result.totales).toMatchObject({
        totalVentas: 0,
        totalCobros: 0,
        cantidadFacturas: 0,
      });
    });

    it('usa montoIngresado como fallback de movCaja y agrupa por codigoMetodoPago', async () => {
      storeConfigRepo.findHideShiftInfo.mockResolvedValue(false);
      storeConfigRepo.findExchangeRate.mockResolvedValue(1);
      shiftRepo.getSalesReportData.mockResolvedValue({
        lines: [],
        payments: [build({ ...basePayment, montoIngresado: 0, monto: 77 })],
        headers: [],
      });

      const result = await service.getShiftSalesReport(
        '001',
        'POS01',
        'John',
        '1',
        '2026-08-15',
      );

      expect(result.movCaja).toEqual([{ name: 'EFECTIVO', total: 77, cantidad: 0 }]);
      expect(result.cobros).toEqual([{ name: 'EFECTIVO', total: 77, cantidad: 1 }]);
    });

    it('aplica fallbacks con descripciones y grupos vacíos', async () => {
      storeConfigRepo.findHideShiftInfo.mockResolvedValue(false);
      storeConfigRepo.findExchangeRate.mockResolvedValue(1);
      shiftRepo.getSalesReportData.mockResolvedValue({
        lines: [
          build({
            ...baseLine,
            numeroBomba: '01',
            descripcion: '',
            grupoIsv: '',
            montoIsv: 0,
          }),
        ],
        payments: [
          build({
            ...basePayment,
            descripcion: '',
            codigoMetodoPago: 'CASH2',
            monto: 50,
            montoIngresado: 0,
          }),
        ],
        headers: [build({ ...baseHeader })],
      });

      const result = await service.getShiftSalesReport(
        '001',
        'POS01',
        'John',
        '1',
        '2026-08-15',
      );

      expect(result.cobros).toEqual([{ name: 'CASH2', total: 50, cantidad: 1 }]);
      expect(result.movCaja).toEqual([{ name: 'CASH2', total: 50, cantidad: 0 }]);
      expect(result.combustibles).toEqual([{ name: '', total: 100, cantidad: 0 }]);
      expect(result.impuestos).toEqual([{ name: '', total: 0, cantidad: 0 }]);
    });

    it('agrupa pagos sin descripción ni método por clave vacía', async () => {
      storeConfigRepo.findHideShiftInfo.mockResolvedValue(false);
      storeConfigRepo.findExchangeRate.mockResolvedValue(1);
      shiftRepo.getSalesReportData.mockResolvedValue({
        lines: [],
        payments: [
          build({
            ...basePayment,
            descripcion: '',
            codigoMetodoPago: '',
            monto: 30,
            montoIngresado: 0,
          }),
        ],
        headers: [],
      });

      const result = await service.getShiftSalesReport(
        '001',
        'POS01',
        'John',
        '1',
        '2026-08-15',
      );

      expect(result.cobros).toEqual([{ name: '', total: 30, cantidad: 1 }]);
      expect(result.movCaja).toEqual([{ name: '', total: 30, cantidad: 0 }]);
    });

    it('agrupa otros productos con descripción vacía', async () => {
      storeConfigRepo.findHideShiftInfo.mockResolvedValue(false);
      storeConfigRepo.findExchangeRate.mockResolvedValue(1);
      shiftRepo.getSalesReportData.mockResolvedValue({
        lines: [
          build({
            ...baseLine,
            numeroBomba: '',
            descripcion: '',
            montoConIsv: 40,
          }),
        ],
        payments: [],
        headers: [],
      });

      const result = await service.getShiftSalesReport(
        '001',
        'POS01',
        'John',
        '1',
        '2026-08-15',
      );

      expect(result.otrosProductos).toEqual([{ name: '', total: 40, cantidad: 0 }]);
    });
  });
});

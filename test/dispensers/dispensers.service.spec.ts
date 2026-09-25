import { Test } from '@nestjs/testing';
import { NotFoundDomainError } from '../../src/domain/errors/domain-error';
import {
  DispensersService,
  LocalDispenser,
} from '../../src/application/services/dispensers.service';
import type { DispenserRepository } from '../../src/domain/ports/out/dispenser-repository.interface';

const expose = (service: DispensersService) =>
  service as unknown as {
    dispensers: Map<number, LocalDispenser>;
    tickSimulation: () => void;
  };

describe('DispensersService', () => {
  let service: DispensersService;
  let repo: jest.Mocked<DispenserRepository>;

  beforeEach(async () => {
    repo = {
      getSimpleHoseConfigs: jest.fn(),
      getPendingSales: jest.fn(),
      getHoseConfigs: jest.fn(),
      getPumpTransactions: jest.fn(),
    } as unknown as jest.Mocked<DispenserRepository>;

    const module = await Test.createTestingModule({
      providers: [
        DispensersService,
        { provide: 'DispenserRepository', useValue: repo },
      ],
    }).compile();

    service = module.get(DispensersService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('inicializa 4 bombas por defecto', () => {
    expect(expose(service).dispensers.size).toBe(4);
    expect(expose(service).dispensers.get(1)).toMatchObject({
      pumpId: 1,
      state: 'idle',
      unitPrice: 30.5,
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('carga hoses y arranca el timer', async () => {
      jest.useFakeTimers();
      repo.getSimpleHoseConfigs.mockResolvedValue([]);
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await service.onModuleInit();

      expect(repo.getSimpleHoseConfigs).toHaveBeenCalled();
      expect(setIntervalSpy).toHaveBeenCalled();

      jest.advanceTimersByTime(4000);
      service.onModuleDestroy();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('no revienta si la carga de hoses falla', async () => {
      repo.getSimpleHoseConfigs.mockRejectedValue(new Error('db down'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await service.onModuleInit();

      expect(warnSpy).toHaveBeenCalled();
      service.onModuleDestroy();
    });
  });

  describe('getDispensers', () => {
    it('devuelve estado colgada para ventas pendientes en vivo', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([
        { pumpId: 1, productName: 'Súper', unitPrice: 30, pos: 'POS01' },
      ]);
      repo.getPendingSales.mockResolvedValue([
        {
          SaleID: 55,
          PumpNumber: 1,
          HoseId: 1,
          amount: 120,
          ppu: 30,
          volume: 4,
          GradeNr: 1,
          IsInvoiced: false,
          ShiftId: null,
        },
      ]);

      const result = await service.getDispensers();

      expect(result[0]).toMatchObject({
        pumpId: 1,
        state: 'colgada',
        gallons: 4,
        amount: 120,
        unitPrice: 30,
        saleId: 55,
        pos: 'POS01',
      });
    });

    it('aplica config de hoses a bombas idle y crea bombas nuevas', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([
        { pumpId: 1, productName: 'Súper XL', unitPrice: 31, pos: null },
        { pumpId: 9, productName: 'Turbodisel', unitPrice: 26, pos: 'POS02' },
      ]);
      repo.getPendingSales.mockResolvedValue([]);

      const result = await service.getDispensers();

      const pump1 = result.find((d) => d.pumpId === 1);
      const pump9 = result.find((d) => d.pumpId === 9);
      expect(pump1).toMatchObject({ productName: 'Súper XL', unitPrice: 31 });
      expect(pump9).toMatchObject({
        pumpId: 9,
        state: 'idle',
        productName: 'Turbodisel',
        unitPrice: 26,
        pos: 'POS02',
      });
    });

    it('hace fallback silencioso si getPendingSales falla', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([]);
      repo.getPendingSales.mockRejectedValue(new Error('no table'));

      const result = await service.getDispensers();

      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it('hace fallback a bombas 1-4 sin hoses activos', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([]);
      repo.getPendingSales.mockResolvedValue([]);

      const result = await service.getDispensers();

      expect(result.map((d) => d.pumpId)).toEqual([1, 2, 3, 4]);
    });

    it('hace fallback a 1-4 si el mapeo de hoses lanza', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([null as never]);
      repo.getPendingSales.mockResolvedValue([]);

      const result = await service.getDispensers();

      expect(result.map((d) => d.pumpId)).toEqual([1, 2, 3, 4]);
    });

    it('crea bombas nuevas desde la config de hoses', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([
        { pumpId: 1, productName: 'Súper', unitPrice: 30, pos: null },
        { pumpId: 50, productName: 'Turbo', unitPrice: 27, pos: 'POS09' },
      ]);
      repo.getPendingSales.mockResolvedValue([]);

      const result = await service.getDispensers();

      expect(result.some((d) => d.pumpId === 50)).toBe(true);
      const pump50 = result.find((d) => d.pumpId === 50);
      expect(pump50).toMatchObject({
        pumpId: 50,
        state: 'idle',
        productName: 'Turbo',
        unitPrice: 27,
        pos: 'POS09',
      });
    });

    it('aplica fallbacks con productName y unitPrice vacíos', async () => {
      repo.getSimpleHoseConfigs.mockResolvedValue([
        { pumpId: 1, productName: '', unitPrice: 0, pos: null },
        { pumpId: 9, productName: '', unitPrice: 0, pos: null },
      ]);
      repo.getPendingSales.mockResolvedValue([]);

      const result = await service.getDispensers();

      const pump1 = result.find((d) => d.pumpId === 1);
      const pump9 = result.find((d) => d.pumpId === 9);
      expect(pump1).toMatchObject({ productName: 'Súper', unitPrice: 30.5 });
      expect(pump9).toMatchObject({ productName: 'Súper', unitPrice: 0 });
    });
  });

  describe('getHoses', () => {
    it('mapea las filas completas', async () => {
      repo.getHoseConfigs.mockResolvedValue([
        {
          id: 1,
          hoseId: 2,
          gradeNumber: 3,
          gradeName: 'REGULAR',
          pricePerUnit: 27.5,
          pumpId: 1,
          hosePhysicalId: 2,
          codigoPos: 'REGULAR',
          esVisible: true,
        },
      ] as never);

      const result = await service.getHoses();

      expect(result).toEqual([
        {
          id: 1,
          hoseId: 2,
          gradeNumber: 3,
          gradeName: 'REGULAR',
          pricePerUnit: 27.5,
          pumpId: 1,
          hosePhysicalId: 2,
          codigoPos: 'REGULAR',
          esVisible: true,
        },
      ]);
    });

    it('usa fallback de 12 mangueras si la consulta falla', async () => {
      repo.getHoseConfigs.mockRejectedValue(new Error('db down'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.getHoses();

      expect(result).toHaveLength(12);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('getPumpTransactions', () => {
    it('delega en el repositorio', async () => {
      repo.getPumpTransactions.mockResolvedValue([
        { saleId: 1, pumpNumber: 2, amount: 100 },
      ] as never);

      const result = await service.getPumpTransactions(2, 5);

      expect(repo.getPumpTransactions).toHaveBeenCalledWith(2, 5);
      expect(result).toHaveLength(1);
    });

    it('genera transacciones mock si el repo falla', async () => {
      repo.getPumpTransactions.mockRejectedValue(new Error('db down'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expose(service).dispensers.set(1, {
        pumpId: 1,
        state: 'colgada',
        productName: 'Súper',
        gallons: 3,
        amount: 90,
        unitPrice: 30,
        limitAmount: null,
        saleId: 555,
      });

      const result = await service.getPumpTransactions(1);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((t) => t.estado === 'Sin Facturar')).toBe(true);
      expect(result.some((t) => t.estado === 'Facturado')).toBe(true);
      expect(result.some((t) => t.ciclo === 'Atrasada')).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('authorizePump', () => {
    it('autoriza la bomba con límite por defecto', () => {
      const result = service.authorizePump({ pumpId: 1 } as never);

      expect(result).toEqual({ success: true });
      expect(expose(service).dispensers.get(1)).toMatchObject({
        state: 'authorized',
        limitAmount: 1500,
        amount: 0,
        gallons: 0,
      });
    });

    it('usa el límite provisto', () => {
      service.authorizePump({ pumpId: 2, limitAmount: 800 });

      expect(expose(service).dispensers.get(2)?.limitAmount).toBe(800);
    });

    it('lanza NotFound para una bomba desconocida', () => {
      expect(() => service.authorizePump({ pumpId: 99 } as never)).toThrow(
        NotFoundDomainError,
      );
    });
  });

  describe('clearPumpSale', () => {
    it('vuelve la bomba a idle', () => {
      const exposed = expose(service);
      exposed.dispensers.set(1, {
        pumpId: 1,
        state: 'colgada',
        productName: 'Súper',
        gallons: 5,
        amount: 150,
        unitPrice: 30,
        limitAmount: 1500,
        saleId: 55,
      });

      service.clearPumpSale(1);

      expect(exposed.dispensers.get(1)).toMatchObject({
        state: 'idle',
        amount: 0,
        gallons: 0,
        limitAmount: null,
      });
    });

    it('no hace nada si la bomba no existe', () => {
      expect(() => service.clearPumpSale(999)).not.toThrow();
    });
  });

  describe('tickSimulation', () => {
    it('transiciona idle a calling con probabilidad', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.05);
      const exposed = expose(service);

      exposed.tickSimulation();

      expect(exposed.dispensers.get(1)?.state).toBe('calling');
    });

    it('mantiene idle cuando no dispara la probabilidad', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.95);
      const exposed = expose(service);

      exposed.tickSimulation();

      expect(exposed.dispensers.get(1)?.state).toBe('idle');
    });

    it('pasa authorized a fueling', () => {
      const exposed = expose(service);
      exposed.dispensers.set(1, {
        pumpId: 1,
        state: 'authorized',
        productName: 'Súper',
        gallons: 0,
        amount: 0,
        unitPrice: 30,
        limitAmount: null,
        saleId: null,
      });

      exposed.tickSimulation();

      expect(exposed.dispensers.get(1)?.state).toBe('fueling');
    });

    it('acumula combustible hasta el límite y pasa a colgada', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const exposed = expose(service);
      exposed.dispensers.set(1, {
        pumpId: 1,
        state: 'fueling',
        productName: 'Súper',
        gallons: 0,
        amount: 0,
        unitPrice: 30,
        limitAmount: 200,
        saleId: null,
      });

      exposed.tickSimulation();

      const pump = exposed.dispensers.get(1);
      expect(pump?.state).toBe('colgada');
      expect(pump?.amount).toBe(200);
      expect(pump?.gallons).toBe(Number((200 / 30).toFixed(2)));
    });

    it('sigue en fueling si no alcanza el límite', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const exposed = expose(service);
      exposed.dispensers.set(1, {
        pumpId: 1,
        state: 'fueling',
        productName: 'Súper',
        gallons: 0,
        amount: 0,
        unitPrice: 30,
        limitAmount: 10000,
        saleId: null,
      });

      exposed.tickSimulation();

      expect(exposed.dispensers.get(1)?.state).toBe('fueling');
      expect(exposed.dispensers.get(1)?.amount).toBe(200);
    });
  });
});

import { FusionSyncService } from '../../src/application/services/fusion-sync.service';

jest.mock('mssql', () => ({ connect: jest.fn() }));
import { connect } from 'mssql';

const connectMock = connect as unknown as jest.Mock;

const row = {
  SaleID: 10,
  PosNumber: 1,
  PumpNumber: 2,
  HoseNumber: '3',
  Amount: 250.5,
  PPU: 41.75,
  Volume: 6,
  FinalVolumeTotal: 100,
  InitialVolumeTotal: 94,
  PaymentType: 'EFECTIVO',
  PaymentInfo: 'X',
  CompensatedTemperature: '20',
  ShiftID: 'S1',
  GradeNr: 1,
  PriceLevel: 1,
  TypeOfTransaction: 'D',
  DateOfTransaction: '2026-08-15',
  TimeOfTransaction: '08:00:00',
  PresetAmount: 250,
  PaymentAlarm: 'N',
  ATCVO: 'a',
  AVGTM: 'b',
  ATCIVO: 'c',
  ATCFVO: 'd',
  IsInvoiced: true,
  Date: new Date('2026-08-15T08:00:00.000Z'),
};

const makePool = (rows: unknown[]) => ({
  request: () => ({
    query: jest.fn().mockResolvedValue({ recordset: rows }),
  }),
  close: jest.fn().mockResolvedValue(undefined),
});

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  getExistingSaleIds: jest.fn().mockResolvedValue([]),
  createSales: jest.fn().mockResolvedValue(1),
  ...overrides,
});

describe('FusionSyncService', () => {
  beforeEach(() => {
    delete process.env.MSSQL_URL;
    jest.clearAllMocks();
  });

  describe('parseMssql', () => {
    it('parsa la URL con usuario, clave, base y puerto', () => {
      const svc = new FusionSyncService(makeRepo() as any);
      const config = (svc as any).parseMssql(
        'sqlserver://localhost:1433;User=sa;Password=pass;Database=Fusion;',
      );

      expect(config).toMatchObject({
        server: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'pass',
        database: 'Fusion',
      });
      expect(config.options).toEqual({
        trustServerCertificate: true,
        encrypt: false,
      });
    });

    it('usa el puerto 1433 por defecto y tolera parámetros sin valor', () => {
      const svc = new FusionSyncService(makeRepo() as any);
      const config = (svc as any).parseMssql('sqlserver://host;database=DB');

      expect(config.port).toBe(1433);
      expect(config.server).toBe('host');
      expect(config.user).toBeUndefined();
    });

    it('lanza error si la URL no es sqlserver://', () => {
      const svc = new FusionSyncService(makeRepo() as any);
      expect(() => (svc as any).parseMssql('mssql://nope')).toThrow(
        'MSSQL_URL inválida',
      );
    });
  });

  describe('connect', () => {
    it('deshabilita el sync si no existe MSSQL_URL', async () => {
      const svc = new FusionSyncService(makeRepo() as any);
      const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();

      await (svc as any).connect();

      expect(svc.status.connected).toBe(false);
      expect(connectMock).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('conecta y marca connected cuando la conexión tiene éxito', async () => {
      process.env.MSSQL_URL = 'sqlserver://host;database=DB';
      connectMock.mockResolvedValue(makePool([]));

      const svc = new FusionSyncService(makeRepo() as any);
      await (svc as any).connect();

      expect(connectMock).toHaveBeenCalled();
      expect(svc.status.connected).toBe(true);
    });

    it('registra el error y queda disconnected si falla la conexión', async () => {
      process.env.MSSQL_URL = 'sqlserver://host;database=DB';
      connectMock.mockRejectedValue(new Error('timeout'));

      const svc = new FusionSyncService(makeRepo() as any);
      await (svc as any).connect();

      expect(svc.status.connected).toBe(false);
      expect(svc.status.lastError).toBe('timeout');
    });
  });

  describe('mapRow', () => {
    it('mapea todos los campos numéricos, strings y fecha', () => {
      const svc = new FusionSyncService(makeRepo() as any);
      const mapped = (svc as any).mapRow(row);

      expect(mapped).toMatchObject({
        idVenta: 10,
        numeroPos: 1,
        numeroBomba: 2,
        numeroManguera: '3',
        monto: 250.5,
        precioUnitario: 41.75,
        volumen: 6,
        volumenFinal: 100,
        volumenInicial: 94,
        tipoPago: 'EFECTIVO',
        idTurno: 'S1',
        numeroGrado: 1,
        fechaTransaccion: '2026-08-15',
        horaTransaccion: '08:00:00',
        facturada: true,
      });
      expect(mapped.fecha).toEqual(new Date('2026-08-15T08:00:00.000Z'));
    });

    it('mapea nulos y valores no numéricos como null/false', () => {
      const svc = new FusionSyncService(makeRepo() as any);
      const mapped = (svc as any).mapRow({
        SaleID: 11,
        PosNumber: null,
        Amount: null,
        IsInvoiced: false,
        Date: null,
      });

      expect(mapped).toMatchObject({
        idVenta: 11,
        numeroPos: null,
        monto: null,
        facturada: false,
        fecha: null,
      });
    });
  });

  describe('insertMissing', () => {
    it('no hace nada con filas vacías', async () => {
      const repo = makeRepo();
      const svc = new FusionSyncService(repo as any);

      const count = await (svc as any).insertMissing([]);

      expect(count).toBe(0);
      expect(repo.getExistingSaleIds).not.toHaveBeenCalled();
    });

    it('omite ventas ya existentes y crea solo las nuevas', async () => {
      const repo = makeRepo({
        getExistingSaleIds: jest.fn().mockResolvedValue([10]),
        createSales: jest.fn().mockResolvedValue(2),
      });
      const svc = new FusionSyncService(repo as any);

      const count = await (svc as any).insertMissing([
        { SaleID: 10 },
        { SaleID: 11 },
        { SaleID: 12 },
      ]);

      expect(count).toBe(2);
      const created = repo.createSales.mock.calls[0][0];
      expect(created.map((c: { idVenta: number }) => c.idVenta)).toEqual([
        11, 12,
      ]);
    });

    it('devuelve 0 si no hay ventas nuevas', async () => {
      const repo = makeRepo({
        getExistingSaleIds: jest.fn().mockResolvedValue([10, 11]),
      });
      const svc = new FusionSyncService(repo as any);

      const count = await (svc as any).insertMissing([{ SaleID: 10 }]);

      expect(count).toBe(0);
      expect(repo.createSales).not.toHaveBeenCalled();
    });
  });

  describe('fullSync', () => {
    it('no hace nada sin pool', async () => {
      const repo = makeRepo();
      const svc = new FusionSyncService(repo as any);

      await (svc as any).fullSync();

      expect(repo.getExistingSaleIds).not.toHaveBeenCalled();
    });

    it('inserta filas nuevas y actualiza el estado', async () => {
      process.env.MSSQL_URL = 'sqlserver://host;database=DB';
      const pool = makePool([{ SaleID: 10 }, { SaleID: 11 }]);
      connectMock.mockResolvedValue(pool);
      const repo = makeRepo({
        getExistingSaleIds: jest.fn().mockResolvedValue([]),
        createSales: jest.fn().mockResolvedValue(2),
      });
      const svc = new FusionSyncService(repo as any);
      await (svc as any).connect();

      await (svc as any).fullSync();

      expect(svc.status.lastInserted).toBe(2);
      expect(svc.status.lastSyncAt).toBeInstanceOf(Date);
      expect(svc.status.lastError).toBeNull();
    });

    it('captura errores de lectura y deja lastError', async () => {
      process.env.MSSQL_URL = 'sqlserver://host;database=DB';
      const pool = {
        request: () => ({
          query: jest.fn().mockRejectedValue(new Error('read failed')),
        }),
      };
      connectMock.mockResolvedValue(pool as any);
      const svc = new FusionSyncService(makeRepo() as any);
      await (svc as any).connect();

      await (svc as any).fullSync();

      expect(svc.status.lastError).toBe('read failed');
      expect(svc.status.lastSyncAt).toBeNull();
    });

    it('ignora errores si el valor no es Error', async () => {
      const svc = new FusionSyncService(makeRepo() as any);
      (svc as any).pool = {
        request: () => ({ query: jest.fn().mockRejectedValue('boom') }),
      };

      await (svc as any).fullSync();

      expect(svc.status.lastError).toBe('"boom"');
    });
  });

  describe('ciclo de vida', () => {
    it('onModuleInit programa los timers y arranca bootstrap', () => {
      jest.useFakeTimers();
      const svc = new FusionSyncService(makeRepo() as any);
      const bootstrap = jest
        .spyOn(svc, 'bootstrap' as never)
        .mockResolvedValue(undefined as never);
      svc['bootstrap'] = bootstrap as any;

      svc.onModuleInit();

      expect(svc['timer']).toBeDefined();
      expect(svc['reconcileTimer']).toBeDefined();
      expect(bootstrap).toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      jest.advanceTimersByTime(60000);
      jest.useRealTimers();
    });

    it('onModuleDestroy limpia timers y cierra el pool', () => {
      jest.useFakeTimers();
      const pool = makePool([]);
      const svc = new FusionSyncService(makeRepo() as any);
      svc['pool'] = pool;
      svc.onModuleInit();

      svc.onModuleDestroy();

      expect(pool.close).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('bootstrap conecta y hace un fullSync', async () => {
      const svc = new FusionSyncService(makeRepo() as any);
      const connectSpy = jest
        .spyOn(svc, 'connect' as never)
        .mockResolvedValue(undefined as never);
      const fullSync = jest
        .spyOn(svc, 'fullSync' as never)
        .mockResolvedValue(undefined as never);

      await (svc as any).bootstrap();

      expect(connectSpy).toHaveBeenCalled();
      expect(fullSync).toHaveBeenCalled();
    });
  });
});

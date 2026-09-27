import { StoreBootstrapService } from '../../../src/application/services/store-bootstrap.service';

describe('StoreBootstrapService', () => {
  let service: StoreBootstrapService;
  let prismaMock: any;
  let txMock: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.BACKOFFICE_SYNC_URL;
    delete process.env.BACKOFFICE_SYNC_KEY;
    delete process.env.STORE_CODE;

    txMock = {
      moneda: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      tienda: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      configuracionPos: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      manguera: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      configuracionTienda: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      // SAR Series - Guard: Should NEVER be called during store bootstrap
      serieDocumento: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    prismaMock = {
      configuracionTienda: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      serieDocumento: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(txMock);
      }),
    };

    service = new StoreBootstrapService(prismaMock);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('bootstrapStoreConfig', () => {
    it('retorna NOT_CONFIGURED si BACKOFFICE_SYNC_URL no está definido', async () => {
      const result = await service.bootstrapStoreConfig();
      expect(result.applied).toBe(false);
      expect(result.reason).toBe('NOT_CONFIGURED');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('descarga configuración de la Matriz y aplica tienda, configuracionPos y mangueras atómicamente', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '002';
      process.env.BACKOFFICE_SYNC_KEY = 'test-sync-key';

      const mockSnapshot = {
        storeCode: '002',
        configVersion: 1,
        tienda: {
          nombre: 'Estación 002 El Sur',
          rtn: '0801199912345',
          emisor: 'Inversiones Sur S.A.',
          direccion1: 'Salida al Sur km 5',
          ipFusion: '192.168.1.50',
          urlControlador: 'http://localhost:5008',
          moneda: 'HNL',
          codigoMoneda: 'HNL',
        },
        configuracionPos: {
          codigoPos: '01',
          pantallaEnBomba: true,
          numTransaccionesBombas: 500,
          minutosAtrasada: 45,
        },
        mangueras: [
          {
            idManguera: 1,
            idBomba: 1,
            idMangueraFisica: 1,
            numeroGrado: 1,
            nombreGrado: 'SUPER',
            precioUnitario: 130.5,
            codigoPos: '1',
            visible: true,
            unidadMedida: 'GL',
            codigoMoneda: 'HNL',
          },
          {
            idManguera: 2,
            idBomba: 1,
            idMangueraFisica: 2,
            numeroGrado: 2,
            nombreGrado: 'REGULAR',
            precioUnitario: 115.0,
            codigoPos: '1',
            visible: true,
            unidadMedida: 'GL',
            codigoMoneda: 'HNL',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSnapshot,
      } as any);

      const result = await service.bootstrapStoreConfig();

      expect(result.applied).toBe(true);
      expect(result.reason).toBe('APPLIED');
      expect(result.storeCode).toBe('002');
      expect(result.configVersion).toBe(1);
      expect(result.hosesCount).toBe(2);

      // Verificación de llamada a fetch con cabecera de autenticación
      expect(global.fetch).toHaveBeenCalledWith(
        'https://backoffice.internal/api/sync/down/config?storeCode=002',
        expect.objectContaining({
          method: 'GET',
          headers: { 'x-sync-key': 'test-sync-key' },
        }),
      );

      // Verificación de transacción atómica
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      // Verificación de upsert en tiendas
      expect(txMock.tienda.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idTienda: '002' },
          update: expect.objectContaining({
            nombre: 'Estación 002 El Sur',
            rtn: '0801199912345',
            ipFusion: '192.168.1.50',
          }),
        }),
      );

      // Verificación de upsert en configuracion_pos
      expect(txMock.configuracionPos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { codigoPos: '01' },
          update: expect.objectContaining({
            pantallaEnBomba: true,
            numTransaccionesBombas: 500,
          }),
        }),
      );

      // Verificación de upsert en mangueras (ambas mangueras)
      expect(txMock.manguera.upsert).toHaveBeenCalledTimes(2);
      expect(txMock.manguera.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idManguera: 1 },
          update: expect.objectContaining({
            nombreGrado: 'SUPER',
            precioUnitario: 130.5,
          }),
        }),
      );
      expect(txMock.manguera.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idManguera: 2 },
          update: expect.objectContaining({
            nombreGrado: 'REGULAR',
            precioUnitario: 115.0,
          }),
        }),
      );

      // Verificación de version guardada en configuracion_tienda
      expect(txMock.configuracionTienda.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idTienda: '002' },
          update: expect.objectContaining({
            config: expect.objectContaining({ configVersion: 1 }),
          }),
        }),
      );

      // =========================================================================
      // AISLAMIENTO FISCAL SAR ESTRICTO:
      // Se garantiza que NINGÚN método de serieDocumento / series fue ejecutado.
      // =========================================================================
      expect(txMock.serieDocumento.create).not.toHaveBeenCalled();
      expect(txMock.serieDocumento.update).not.toHaveBeenCalled();
      expect(txMock.serieDocumento.delete).not.toHaveBeenCalled();
      expect(txMock.serieDocumento.deleteMany).not.toHaveBeenCalled();
      expect(txMock.serieDocumento.upsert).not.toHaveBeenCalled();
      expect(prismaMock.serieDocumento.delete).not.toHaveBeenCalled();
      expect(prismaMock.serieDocumento.deleteMany).not.toHaveBeenCalled();
    });

    it('omite aplicar si la versión remota ya coincide con la versión local (UP_TO_DATE)', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      prismaMock.configuracionTienda.findUnique.mockResolvedValue({
        idTienda: '001',
        config: { configVersion: 5 },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          storeCode: '001',
          configVersion: 5,
          tienda: { nombre: 'Estación 001' },
          configuracionPos: { codigoPos: '01' },
          mangueras: [],
        }),
      } as any);

      const result = await service.bootstrapStoreConfig(false);

      expect(result.applied).toBe(false);
      expect(result.reason).toBe('UP_TO_DATE');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('aplica forzadamente cuando force = true aunque la versión local coincida', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      prismaMock.configuracionTienda.findUnique.mockResolvedValue({
        idTienda: '001',
        config: { configVersion: 5 },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          storeCode: '001',
          configVersion: 5,
          tienda: { nombre: 'Estación 001' },
          configuracionPos: { codigoPos: '01' },
          mangueras: [],
        }),
      } as any);

      const result = await service.bootstrapStoreConfig(true);

      expect(result.applied).toBe(true);
      expect(result.reason).toBe('APPLIED');
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('maneja fallos de red sin romper la ejecución (resiliencia offline-first)', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error / connection refused'));

      const result = await service.bootstrapStoreConfig();

      expect(result.applied).toBe(false);
      expect(result.reason).toBe('OFFLINE');
      expect(result.error).toContain('Network error');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza respuestas con payload corrupto o sin configVersion', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          storeCode: '001',
          // configVersion missing
          tienda: {},
        }),
      } as any);

      const result = await service.bootstrapStoreConfig();

      expect(result.applied).toBe(false);
      expect(result.reason).toBe('INVALID_RESPONSE');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});

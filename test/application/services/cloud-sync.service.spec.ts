import { CloudSyncService } from '../../../src/application/services/cloud-sync.service';

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let prismaMock: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.BACKOFFICE_SYNC_URL;
    delete process.env.BACKOFFICE_SYNC_KEY;
    delete process.env.STORE_CODE;

    prismaMock = {
      venta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      precioProducto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new CloudSyncService(prismaMock);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('getSyncStatus', () => {
    it('retorna not_configured si BACKOFFICE_SYNC_URL no está definido', () => {
      const status = service.getSyncStatus();
      expect(status.status).toBe('not_configured');
      expect(status.pendingCount).toBe(0);
    });

    it('retorna online si BACKOFFICE_SYNC_URL está configurado', () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      const status = service.getSyncStatus();
      expect(status.status).toBe('online');
    });
  });

  describe('syncPendingSales', () => {
    it('no realiza peticiones si BACKOFFICE_SYNC_URL no está configurado', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const result = await service.syncPendingSales();
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('envía ventas pendientes y actualiza estado a online', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      prismaMock.venta.findMany.mockResolvedValue([
        {
          idTransaccionPos: 'TX-1',
          tipoDocumento: 1,
          numeroDocumento: '001-001-01-00000001',
          fechaHoraVenta: new Date('2026-09-25T13:00:00Z'),
          subtotal: 100,
          monto: 115,
          lineasVenta: [],
          pagosVenta: [],
        },
      ]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, processedSales: 1 }),
      });

      const result = await service.syncPendingSales();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://backoffice.internal/api/sync/up',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-sync-key': 'prisma-cloud-sync-key',
          }),
        }),
      );

      const status = service.getSyncStatus();
      expect(status.status).toBe('online');
      expect(status.pendingCount).toBe(0);
      expect(status.lastSyncAt).not.toBeNull();
    });

    it('captura errores de red y cambia estado a offline sin lanzar excepción', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';

      prismaMock.venta.findMany.mockResolvedValue([
        {
          idTransaccionPos: 'TX-2',
          fechaHoraVenta: new Date('2026-09-25T13:00:00Z'),
          lineasVenta: [],
          pagosVenta: [],
        },
      ]);

      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

      const result = await service.syncPendingSales();

      expect(result.success).toBe(false);
      expect(result.syncedCount).toBe(0);

      const status = service.getSyncStatus();
      expect(status.status).toBe('offline');
      expect(status.error).toContain('Network offline');
    });
  });

  describe('pullMasters', () => {
    it('descarga y aplica precios si el Backoffice reporta actualizaciones', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hasUpdates: true,
          masterVersion: 120,
          fuelPrices: [{ gradeId: 1, unitPrice: 33.5 }],
        }),
      });

      const result = await service.pullMasters();

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(prismaMock.precioProducto.updateMany).toHaveBeenCalledWith({
        where: { idManguera: 1 },
        data: { precioUnitarioConIsv: 33.5 },
      });
    });
  });
});

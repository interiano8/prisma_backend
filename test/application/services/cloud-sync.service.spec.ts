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
      reglaDescuento: {
        upsert: jest.fn().mockResolvedValue({}),
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

    it('empaqueta turnos cerrados con totales de control en el payload de sincronización', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      prismaMock.turno = {
        findMany: jest.fn().mockResolvedValue([
          {
            idTransaccionPos: 'SHIFT-TX-1',
            idTienda: '001',
            codigoPos: '01',
            turno: '1',
            inicioTurno: new Date('2026-09-25T06:00:00Z'),
            finTurno: new Date('2026-09-25T14:00:00Z'),
            importeContado: 500,
            nombreEmpleado: 'Juan Perez',
            detallePagos: { '1002': 500, '1003': 200 },
          },
        ]),
      };

      prismaMock.registroTransaccion = {
        findMany: jest.fn().mockResolvedValue([
          { idTransaccionPos: 'TX-001' },
          { idTransaccionPos: 'TX-002' },
        ]),
      };

      prismaMock.venta.findMany
        .mockResolvedValueOnce([]) // pendingSales (vacío)
        .mockResolvedValueOnce([
          { monto: 400, descuento: 0 },
          { monto: 300, descuento: 0 },
        ]); // ventas del turno

      let capturedPayload: any;
      global.fetch = jest.fn().mockImplementation(async (_url, opts) => {
        capturedPayload = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({ success: true, processedSales: 0 }),
        };
      });

      const result = await service.syncPendingSales();
      expect(result.success).toBe(true);
      expect(capturedPayload.shifts).toBeDefined();
      expect(capturedPayload.shifts).toHaveLength(1);

      const shiftPayload = capturedPayload.shifts[0];
      expect(shiftPayload.shiftNo).toBe('1');
      expect(shiftPayload.employeeName).toBe('Juan Perez');
      expect(shiftPayload.status).toBe('CLOSED');
      expect(shiftPayload.totalSale).toBe(700);
      expect(shiftPayload.cashDeclared).toBe(500);
      expect(shiftPayload.cardDeclared).toBe(200);
      expect(shiftPayload.controlTotals).toEqual({
        totalSalesCount: 2,
        totalSalesAmount: 700,
        firstTransactionId: 'TX-001',
        lastTransactionId: 'TX-002',
      });
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

    it('descarga y aplica reglas de descuento desde Store 000', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hasUpdates: true,
          masterVersion: 121,
          discountRules: [
            {
              id: 'rule-flota-1',
              codigoCliente: 'CLI-001',
              tipoBeneficio: 'MONTO_VOLUMEN',
              valor: 1.5,
              cantidadMinima: 20,
              prioridad: 10,
              activo: true,
            },
          ],
        }),
      });

      const result = await service.pullMasters();

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(prismaMock.reglaDescuento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rule-flota-1' },
        }),
      );
    });
  });

  describe('sendHeartbeatPing', () => {
    it('retorna error si BACKOFFICE_SYNC_URL no está configurado', async () => {
      const result = await service.sendHeartbeatPing();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
      expect(service.getSyncStatus().status).toBe('not_configured');
    });

    it('envía latido al Hub y actualiza estado a online con métrica de latencia', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pong', storeCode: '001', serverTime: '2026-09-26T00:00:00Z' }),
      });

      const result = await service.sendHeartbeatPing();

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeDefined();
      expect(result.serverTime).toBe('2026-09-26T00:00:00Z');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://backoffice.internal/api/sync/ping',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-sync-key': 'prisma-cloud-sync-key',
          }),
          body: JSON.stringify({ storeCode: '001', queueCount: 0 }),
        }),
      );

      const status = service.getSyncStatus();
      expect(status.status).toBe('online');
      expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('captura fallos de red y marca el estado como offline', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';

      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await service.sendHeartbeatPing();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');

      const status = service.getSyncStatus();
      expect(status.status).toBe('offline');
      expect(status.error).toContain('Connection refused');
    });

    it('dispara reintento automático de ventas pendientes tras recuperar enlace', async () => {
      process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
      process.env.STORE_CODE = '001';

      // Simulamos que el estado previo era offline
      (service as any).status = 'offline';

      const syncSpy = jest.spyOn(service, 'triggerNonBlockingSync');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pong', storeCode: '001', serverTime: '2026-09-26T00:00:00Z' }),
      });

      const result = await service.sendHeartbeatPing();

      expect(result.success).toBe(true);
      expect(syncSpy).toHaveBeenCalled();
    });

    it('inicia y detiene el temporizador del ciclo de latidos correctamente', () => {
      jest.useFakeTimers();
      const pingSpy = jest.spyOn(service, 'sendHeartbeatPing').mockResolvedValue({ success: true });

      service.startHeartbeatLoop(1000);
      expect((service as any).heartbeatTimer).not.toBeNull();

      jest.advanceTimersByTime(1000);
      expect(pingSpy).toHaveBeenCalledTimes(1);

      service.stopHeartbeatLoop();
      expect((service as any).heartbeatTimer).toBeNull();
      jest.useRealTimers();
    });
  });
});

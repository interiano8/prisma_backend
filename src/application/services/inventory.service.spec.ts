import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryService in POS Backend', () => {
  let service: InventoryService;
  let prismaMock: any;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.STORE_CODE = '001';
    process.env.STORE_NAME = 'Sucursal Principal';
    process.env.BACKOFFICE_SYNC_URL = 'http://hq.internal/sync';

    prismaMock = {
      inventarioTienda: {
        findUnique: jest.fn().mockResolvedValue({
          idTienda: '001',
          codigoProducto: 'ITEM-123',
          stock: 14,
          minStock: 3,
          actualizadoEn: new Date('2026-10-09T08:00:00Z'),
        }),
        upsert: jest.fn().mockResolvedValue({
          idTienda: '001',
          codigoProducto: 'ITEM-123',
          stock: 14,
          minStock: 3,
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('checkProductStock', () => {
    it('validates stock online against HQ when reachable', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          productCode: 'ITEM-123',
          stock: 42,
          minStock: 5,
          updatedAt: '2026-10-09T14:00:00Z',
        }),
      } as any);

      const result = await service.checkProductStock('ITEM-123');

      expect(result.productCode).toBe('ITEM-123');
      expect(result.stock).toBe(42);
      expect(result.minStock).toBe(5);
      expect(result.isAvailable).toBe(true);
      expect(result.source).toBe('HQ');
      expect(prismaMock.inventarioTienda.upsert).toHaveBeenCalled();
    });

    it('falls back to local store inventory when HQ is unreachable (offline contingency)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network connection timeout'));

      const result = await service.checkProductStock('ITEM-123');

      expect(result.productCode).toBe('ITEM-123');
      expect(result.stock).toBe(14);
      expect(result.minStock).toBe(3);
      expect(result.isAvailable).toBe(true);
      expect(result.source).toBe('LOCAL_OFFLINE');
    });

    it('returns zero stock in offline mode when product is not cached locally', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));
      prismaMock.inventarioTienda.findUnique.mockResolvedValueOnce(null);

      const result = await service.checkProductStock('NON-EXISTENT');

      expect(result.stock).toBe(0);
      expect(result.isAvailable).toBe(false);
      expect(result.source).toBe('LOCAL_OFFLINE');
    });
  });

  describe('getNetworkStock', () => {
    it('retrieves multi-branch stock from HQ when online', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          productCode: 'ITEM-123',
          items: [
            { storeCode: '001', storeName: 'Centro', stock: 10, minStock: 2, isAvailable: true },
            { storeCode: '002', storeName: 'Norte', stock: 25, minStock: 5, isAvailable: true },
          ],
          totalNetworkStock: 35,
        }),
      } as any);

      const result = await service.getNetworkStock('ITEM-123');

      expect(result.source).toBe('HQ');
      expect(result.items).toHaveLength(2);
      expect(result.totalNetworkStock).toBe(35);
    });

    it('falls back to local branch stock when HQ is unavailable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('DNS lookup failure'));

      const result = await service.getNetworkStock('ITEM-123');

      expect(result.source).toBe('LOCAL_OFFLINE');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].storeCode).toBe('001');
      expect(result.items[0].stock).toBe(14);
      expect(result.totalNetworkStock).toBe(14);
    });
  });

  describe('decrementLocalStock', () => {
    it('decrements local InventarioTienda on checkout', async () => {
      await service.decrementLocalStock('001', [
        { productCode: 'ITEM-123', quantity: 2 },
      ]);

      expect(prismaMock.inventarioTienda.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            idTienda_codigoProducto: {
              idTienda: '001',
              codigoProducto: 'ITEM-123',
            },
          },
          update: {
            stock: { decrement: 2 },
          },
        }),
      );
    });
  });
});

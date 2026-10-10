import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TransfersService in POS Backend', () => {
  let service: TransfersService;
  let prismaMock: any;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.STORE_CODE = '001';
    process.env.BACKOFFICE_SYNC_URL = 'http://hq.internal/sync';
    process.env.BACKOFFICE_SYNC_KEY = 'test-sync-key';

    prismaMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('forwards transfer request to HQ successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'trf-123',
        transferNo: 'TRF-20261010-9999',
        status: 'REQUESTED',
      }),
    } as any);

    const result = await service.requestTransfer({
      fromStoreCode: '002',
      requestedBy: 'CAJERO_TURNO',
      notes: 'Solicitud urgente',
      items: [{ productCode: 'OIL-10W40', quantity: 3 }],
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('REQUESTED');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://hq.internal/api/transfers',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('rejects transfer request when fromStoreCode equals toStoreCode', async () => {
    await expect(
      service.requestTransfer({
        fromStoreCode: '001',
        toStoreCode: '001',
        items: [{ productCode: 'OIL-10W40', quantity: 1 }],
      }),
    ).rejects.toThrow(HttpException);
  });

  it('fetches store transfers from HQ', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'trf-1', transferNo: 'TRF-1', status: 'IN_TRANSIT' },
      ],
    } as any);

    const list = await service.getMyStoreTransfers();
    expect(list).toHaveLength(1);
    expect(list[0].transferNo).toBe('TRF-1');
  });

  it('handles network failure gracefully when querying transfers', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const list = await service.getMyStoreTransfers();
    expect(list).toEqual([]);
  });
});

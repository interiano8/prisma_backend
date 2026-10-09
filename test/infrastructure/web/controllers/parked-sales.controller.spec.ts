import { Test, TestingModule } from '@nestjs/testing';
import { ParkedSalesController } from '../../../../src/infrastructure/web/controllers/parked-sales.controller';
import { ParkedSalesService } from '../../../../src/application/services/parked-sales.service';

describe('ParkedSalesController', () => {
  let controller: ParkedSalesController;
  let service: jest.Mocked<ParkedSalesService>;

  beforeEach(async () => {
    const mockService = {
      parkSale: jest.fn(),
      listActive: jest.fn(),
      resumeSale: jest.fn(),
      discardSale: jest.fn(),
      expireShiftSales: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParkedSalesController],
      providers: [
        {
          provide: ParkedSalesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ParkedSalesController>(ParkedSalesController);
    service = module.get(ParkedSalesService);
  });

  it('crea una venta aparcada', async () => {
    const dto = {
      storeId: '001',
      posNo: 'POS01',
      usuario: 'cajero1',
      turnoId: '101',
      cliente: { code: 'CF', name: 'Consumidor Final' },
      items: [{ code: '01', qty: 2, price: 50, total: 100 }],
      nota: 'Hilux Blanca',
      total: 100,
    };

    const mockResult = {
      id: 'uuid-1',
      codigo: 'A-1',
      ...dto,
      estado: 'PARKED' as const,
      fechaCreacion: new Date(),
      fechaActualizado: new Date(),
    };

    service.parkSale.mockResolvedValue(mockResult);

    const res = await controller.create(dto);
    expect(res).toEqual(mockResult);
    expect(service.parkSale).toHaveBeenCalledWith({
      storeId: dto.storeId,
      posNo: dto.posNo,
      usuario: dto.usuario,
      turnoId: dto.turnoId,
      cliente: dto.cliente,
      items: dto.items,
      nota: dto.nota,
      total: dto.total,
    });
  });

  it('lista las ventas activas de una tienda', async () => {
    const mockList = [
      {
        id: 'uuid-1',
        codigo: 'A-1',
        storeId: '001',
        posNo: 'POS01',
        usuario: 'cajero1',
        turnoId: '101',
        items: [],
        total: 100,
        estado: 'PARKED' as const,
        fechaCreacion: new Date(),
        fechaActualizado: new Date(),
      },
    ];

    service.listActive.mockResolvedValue(mockList);

    const res = await controller.listActive('001');
    expect(res).toEqual(mockList);
    expect(service.listActive).toHaveBeenCalledWith('001');
  });

  it('reanuda una venta aparcada', async () => {
    const mockResumed = {
      id: 'uuid-1',
      codigo: 'A-1',
      storeId: '001',
      posNo: 'POS01',
      usuario: 'cajero1',
      turnoId: '101',
      items: [],
      total: 100,
      estado: 'RESUMED' as const,
      fechaCreacion: new Date(),
      fechaActualizado: new Date(),
    };

    service.resumeSale.mockResolvedValue(mockResumed);

    const res = await controller.resume('uuid-1');
    expect(res.estado).toBe('RESUMED');
    expect(service.resumeSale).toHaveBeenCalledWith('uuid-1');
  });

  it('descarta una venta aparcada', async () => {
    const mockDiscarded = {
      id: 'uuid-1',
      codigo: 'A-1',
      storeId: '001',
      posNo: 'POS01',
      usuario: 'cajero1',
      turnoId: '101',
      items: [],
      total: 100,
      estado: 'DISCARDED' as const,
      fechaCreacion: new Date(),
      fechaActualizado: new Date(),
    };

    service.discardSale.mockResolvedValue(mockDiscarded);

    const res = await controller.discard('uuid-1');
    expect(res.estado).toBe('DISCARDED');
    expect(service.discardSale).toHaveBeenCalledWith('uuid-1');
  });
});

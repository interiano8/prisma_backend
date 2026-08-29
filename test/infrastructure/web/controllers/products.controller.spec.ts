import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from '../../../../src/infrastructure/web/controllers/products.controller';
import { ListProductsUseCase } from '../../../../src/application/use-cases/product/list-products.use-case';
import { GetProductUseCase } from '../../../../src/application/use-cases/product/get-product.use-case';
import { GetProductDiscountUseCase } from '../../../../src/application/use-cases/product/get-product-discount.use-case';
import { GetProductByBarcodeUseCase } from '../../../../src/application/use-cases/product/get-product-by-barcode.use-case';
import { CalculateCartDiscountsUseCase } from '../../../../src/application/use-cases/product/calculate-cart-discounts.use-case';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockList: { execute: jest.Mock };
  let mockGet: { execute: jest.Mock };
  let mockBarcode: { execute: jest.Mock };
  let mockDiscount: { execute: jest.Mock };
  let mockCart: { execute: jest.Mock };

  beforeEach(async () => {
    mockList = { execute: jest.fn() };
    mockGet = { execute: jest.fn() };
    mockBarcode = { execute: jest.fn() };
    mockDiscount = { execute: jest.fn() };
    mockCart = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ListProductsUseCase, useValue: mockList },
        { provide: GetProductUseCase, useValue: mockGet },
        { provide: GetProductByBarcodeUseCase, useValue: mockBarcode },
        { provide: GetProductDiscountUseCase, useValue: mockDiscount },
        { provide: CalculateCartDiscountsUseCase, useValue: mockCart },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('getProducts delega en el use-case', async () => {
    mockList.execute.mockResolvedValue([]);

    await controller.getProducts('COMB');

    expect(mockList.execute).toHaveBeenCalledWith('COMB');
  });

  it('getProductByCode delega en el use-case', async () => {
    mockGet.execute.mockResolvedValue(null);

    await controller.getProductByCode('P1');

    expect(mockGet.execute).toHaveBeenCalledWith('P1');
  });

  it('getProductByBarcode delega en el use-case', async () => {
    mockBarcode.execute.mockResolvedValue(null);

    await controller.getProductByBarcode('123456789');

    expect(mockBarcode.execute).toHaveBeenCalledWith('123456789');
  });

  it('evaluateDiscount devuelve null sin customerCode', async () => {
    expect(await controller.evaluateDiscount('P1', '')).toBeNull();
    expect(mockDiscount.execute).not.toHaveBeenCalled();
  });

  it('evaluateDiscount delega con customerCode', async () => {
    mockDiscount.execute.mockResolvedValue(null);

    await controller.evaluateDiscount('P1', 'C1');

    expect(mockDiscount.execute).toHaveBeenCalledWith('P1', 'C1');
  });

  it('calculateDiscounts valida el body', async () => {
    const items = [{ code: 'P1', quantity: 1, vatGroup: 'IVA', unitPrice: 10 }];

    expect(
      await controller.calculateDiscounts({ customerCode: '', items }),
    ).toBe(items);
    expect(mockCart.execute).not.toHaveBeenCalled();
  });

  it('calculateDiscounts delega en el use-case', async () => {
    const body = {
      customerCode: 'C1',
      items: [{ code: 'P1', quantity: 1, vatGroup: 'IVA', unitPrice: 10 }],
    };
    mockCart.execute.mockResolvedValue([]);

    await controller.calculateDiscounts(body);

    expect(mockCart.execute).toHaveBeenCalledWith('C1', body.items);
  });

  it('calculateDiscounts devuelve [] con items vacíos o undefined', async () => {
    await expect(
      controller.calculateDiscounts({ customerCode: 'C1', items: [] }),
    ).resolves.toEqual([]);
    await expect(
      controller.calculateDiscounts({ customerCode: 'C1' } as never),
    ).resolves.toEqual([]);
    expect(mockCart.execute).not.toHaveBeenCalled();
  });
});

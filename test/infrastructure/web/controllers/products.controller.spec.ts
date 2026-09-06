import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from '../../../../src/infrastructure/web/controllers/products.controller';
import { ListProductsUseCase } from '../../../../src/application/use-cases/product/list-products.use-case';
import { ListCategoriesUseCase } from '../../../../src/application/use-cases/product/list-categories.use-case';
import { GetProductUseCase } from '../../../../src/application/use-cases/product/get-product.use-case';
import { GetProductByBarcodeUseCase } from '../../../../src/application/use-cases/product/get-product-by-barcode.use-case';
import { CalculateCartDiscountsUseCase } from '../../../../src/application/use-cases/product/calculate-cart-discounts.use-case';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockList: { execute: jest.Mock };
  let mockCategories: { execute: jest.Mock };
  let mockGet: { execute: jest.Mock };
  let mockBarcode: { execute: jest.Mock };
  let mockCart: { execute: jest.Mock };

  beforeEach(async () => {
    mockList = { execute: jest.fn() };
    mockCategories = { execute: jest.fn() };
    mockGet = { execute: jest.fn() };
    mockBarcode = { execute: jest.fn() };
    mockCart = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ListProductsUseCase, useValue: mockList },
        { provide: ListCategoriesUseCase, useValue: mockCategories },
        { provide: GetProductUseCase, useValue: mockGet },
        { provide: GetProductByBarcodeUseCase, useValue: mockBarcode },
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

  it('getCategories delega en el use-case', async () => {
    mockCategories.execute.mockResolvedValue([{ codigo: 'COMB', descripcion: 'Combustibles' }]);

    const result = await controller.getCategories();

    expect(mockCategories.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ codigo: 'COMB', descripcion: 'Combustibles' }]);
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

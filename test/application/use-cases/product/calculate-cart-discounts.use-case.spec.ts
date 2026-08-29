import { CalculateCartDiscountsUseCase } from '../../../../src/application/use-cases/product/calculate-cart-discounts.use-case';
import type { ProductRepository } from '../../../../src/domain/ports/out/product-repository.interface';

describe('CalculateCartDiscountsUseCase', () => {
  let useCase: CalculateCartDiscountsUseCase;
  let mockRepo: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      findByCode: jest.fn(),
      findByBarcode: jest.fn(),
      findDiscount: jest.fn(),
      calculateDiscount: jest.fn(),
      getDefaultStoreId: jest.fn(),
      getProductsFiltered: jest.fn(),
      getProductsAll: jest.fn(),
    };
    useCase = new CalculateCartDiscountsUseCase(mockRepo);
  });

  it('acumula resultados con descuento', async () => {
    mockRepo.calculateDiscount.mockResolvedValue({
      code: 'P1',
      hasDiscount: true,
      discountPercentage: 10,
      quantity: 2,
      unitPriceWithIsv: 100,
      unitPriceWithoutIsv: 87,
      unitPriceWithDiscount: 90,
      isvAmountUnit: 13,
      totalWithoutIsv: 174,
      totalDiscount: 20,
      totalIsv: 26,
      finalTotal: 180,
    });

    const result = await useCase.execute('C1', [
      { code: 'P1', quantity: 2, vatGroup: 'IVA', unitPrice: 100 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].hasDiscount).toBe(true);
    expect(mockRepo.calculateDiscount).toHaveBeenCalledWith(
      'P1',
      'C1',
      2,
      'IVA',
      100,
    );
  });

  it('rellena valores por defecto cuando no hay descuento', async () => {
    mockRepo.calculateDiscount.mockResolvedValue(null);

    const result = await useCase.execute('C1', [
      { code: 'P2', quantity: 3, vatGroup: 'IVA', unitPrice: 50 },
    ]);

    expect(result[0]).toEqual({
      code: 'P2',
      hasDiscount: false,
      discountPercentage: 0,
      quantity: 3,
      unitPriceWithIsv: 50,
      unitPriceWithoutIsv: 50,
      unitPriceWithDiscount: 50,
      isvAmountUnit: 0,
      totalWithoutIsv: 150,
      totalDiscount: 0,
      totalIsv: 0,
      finalTotal: 150,
    });
  });
});

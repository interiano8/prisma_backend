import { CalculateCartDiscountsUseCase } from '../../../../src/application/use-cases/product/calculate-cart-discounts.use-case';
import type { ProductRepository } from '../../../../src/domain/ports/out/product-repository.interface';
import { DiscountService } from '../../../../src/domain/services/discount.service';

describe('CalculateCartDiscountsUseCase', () => {
  let useCase: CalculateCartDiscountsUseCase;
  let mockRepo: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      listCategories: jest.fn(),
      findByCode: jest.fn(),
      findByBarcode: jest.fn(),
      findApplicableDiscountRules: jest.fn(),
      getDefaultStoreId: jest.fn(),
      getProductsFiltered: jest.fn(),
      getProductsAll: jest.fn(),
    };
    useCase = new CalculateCartDiscountsUseCase(mockRepo, new DiscountService());
  });

  it('aplica la regla ganadora del motor', async () => {
    mockRepo.findApplicableDiscountRules.mockResolvedValue([
      { id: 'R1', tipoBeneficio: 'PORCENTAJE', valor: 10, prioridad: 0 },
    ]);

    const result = await useCase.execute('C1', [
      { code: 'P1', quantity: 2, vatGroup: 'IVA', unitPrice: 100 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].hasDiscount).toBe(true);
    expect(result[0].discountPercentage).toBe(10);
    expect(result[0].totalDiscount).toBe(20);
    expect(result[0].finalTotal).toBe(180);
    expect(mockRepo.findApplicableDiscountRules).toHaveBeenCalledWith(
      'C1',
      'P1',
      '',
    );
  });

  it('aplica grupo ISV 15 y 18 en el cálculo', async () => {
    mockRepo.findApplicableDiscountRules.mockResolvedValue([
      { id: 'R1', tipoBeneficio: 'PORCENTAJE', valor: 10, prioridad: 0 },
    ]);

    const res15 = await useCase.execute('C1', [
      { code: 'P1', quantity: 1, vatGroup: 'ISV15', unitPrice: 100 },
    ]);
    const res18 = await useCase.execute('C1', [
      { code: 'P1', quantity: 1, vatGroup: 'ISV18', unitPrice: 100 },
    ]);

    expect(res15[0].unitPriceWithoutIsv).toBe(86.96);
    expect(res18[0].unitPriceWithoutIsv).toBe(84.75);
  });

  it('MONTO_FIJO produce percentage 0 pero descuenta', async () => {
    mockRepo.findApplicableDiscountRules.mockResolvedValue([
      { id: 'R1', tipoBeneficio: 'MONTO_FIJO', valor: 2, prioridad: 0 },
    ]);

    const result = await useCase.execute('C1', [
      { code: 'P1', quantity: 2, vatGroup: 'IVA', unitPrice: 100 },
    ]);

    expect(result[0].hasDiscount).toBe(true);
    expect(result[0].discountPercentage).toBe(0);
    expect(result[0].totalDiscount).toBe(4);
  });

  it('evita división por cero con quantity 0', async () => {
    mockRepo.findApplicableDiscountRules.mockResolvedValue([
      { id: 'R1', tipoBeneficio: 'PORCENTAJE', valor: 10, prioridad: 0 },
    ]);

    const result = await useCase.execute('C1', [
      { code: 'P1', quantity: 0, vatGroup: 'IVA', unitPrice: 100 },
    ]);

    expect(result[0].unitPriceWithDiscount).not.toBeNaN();
    expect(result[0].isvAmountUnit).not.toBeNaN();
  });

  it('rellena valores por defecto cuando no hay reglas aplicables', async () => {
    mockRepo.findApplicableDiscountRules.mockResolvedValue([]);

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

  it('consolida reglas acumulables y actualiza totalDiscount y discountPercentage', async () => {
    mockRepo.findApplicableDiscountRules.mockResolvedValue([
      { id: 'R1', tipoBeneficio: 'PORCENTAJE', valor: 10, prioridad: 10, acumulable: false },
      { id: 'R2', tipoBeneficio: 'PORCENTAJE', valor: 5, prioridad: 5, acumulable: true },
    ]);

    const result = await useCase.execute('C1', [
      { code: 'P1', quantity: 1, vatGroup: 'IVA', unitPrice: 100 },
    ]);

    expect(result[0].hasDiscount).toBe(true);
    expect(result[0].discountPercentage).toBe(15);
    expect(result[0].totalDiscount).toBe(15);
    expect(result[0].finalTotal).toBe(85);
  });
});
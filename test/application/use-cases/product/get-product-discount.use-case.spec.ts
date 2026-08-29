import { GetProductDiscountUseCase } from '../../../../src/application/use-cases/product/get-product-discount.use-case';
import { ProductRepository } from '../../../../src/domain/ports/out/product-repository.interface';
import { DiscountService } from '../../../../src/domain/services/discount.service';

describe('GetProductDiscountUseCase', () => {
  let useCase: GetProductDiscountUseCase;
  let mockRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findByCode: jest.fn(),
      findByBarcode: jest.fn(),
      findDiscount: jest.fn(),
      calculateDiscount: jest.fn(),
      getDefaultStoreId: jest.fn(),
      getProductsFiltered: jest.fn(),
      getProductsAll: jest.fn(),
    };
    useCase = new GetProductDiscountUseCase(
      mockRepository,
      new DiscountService(),
    );
  });

  it('devuelve el descuento activo', async () => {
    const discount = {
      codigoCliente: 'C001',
      codigoItem: 'P1',
      porcentaje: 10,
      active: true,
    };
    mockRepository.findDiscount.mockResolvedValue(discount);

    const result = await useCase.execute('P1', 'C001');

    expect(mockRepository.findDiscount).toHaveBeenCalledWith('P1', 'C001');
    expect(result).toEqual(discount);
  });

  it('devuelve null cuando el descuento no existe', async () => {
    mockRepository.findDiscount.mockResolvedValue(null);

    expect(await useCase.execute('P1', 'C001')).toBeNull();
  });

  it('devuelve null cuando el descuento está inactivo', async () => {
    mockRepository.findDiscount.mockResolvedValue({
      codigoCliente: 'C001',
      codigoItem: 'P1',
      porcentaje: 10,
      active: false,
    });

    expect(await useCase.execute('P1', 'C001')).toBeNull();
  });
});

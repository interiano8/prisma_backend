import { GetProductUseCase } from '../../../../src/application/use-cases/product/get-product.use-case';
import { ProductRepository } from '../../../../src/domain/ports/out/product-repository.interface';

describe('GetProductUseCase', () => {
  let useCase: GetProductUseCase;
  let mockRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      listCategories: jest.fn(),
      findByCode: jest.fn(),
      findByBarcode: jest.fn(),
      findApplicableDiscountRules: jest.fn(),
      getDefaultStoreId: jest.fn(),
      getProductsFiltered: jest.fn(),
      getProductsAll: jest.fn(),
    };
    useCase = new GetProductUseCase(mockRepository);
  });

  it('devuelve el producto por código', async () => {
    const product = {
      code: 'P1',
      description: 'Producto',
      unitPrice: 10,
      category: 'CAT',
      vatGroup: 'IVA',
      priceIncludesVat: true,
    };
    mockRepository.findByCode.mockResolvedValue(product);

    const result = await useCase.execute('P1');

    expect(mockRepository.findByCode).toHaveBeenCalledWith('P1');
    expect(result).toEqual(product);
  });

  it('devuelve null cuando el producto no existe', async () => {
    mockRepository.findByCode.mockResolvedValue(null);

    expect(await useCase.execute('NO_EXISTE')).toBeNull();
  });
});

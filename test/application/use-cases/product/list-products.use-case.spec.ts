import { ListProductsUseCase } from '../../../../src/application/use-cases/product/list-products.use-case';
import { ProductRepository } from '../../../../src/domain/ports/out/product-repository.interface';

describe('ListProductsUseCase', () => {
  let useCase: ListProductsUseCase;
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
    useCase = new ListProductsUseCase(mockRepository);
  });

  it('listar productos por categoría', async () => {
    const products = [
      {
        code: 'P1',
        description: 'Producto',
        unitPrice: 10,
        category: 'CAT',
        vatGroup: 'IVA',
        priceIncludesVat: true,
      },
    ];
    mockRepository.findAll.mockResolvedValue(products);

    const result = await useCase.execute('CAT');

    expect(mockRepository.findAll).toHaveBeenCalledWith('CAT');
    expect(result).toEqual(products);
  });

  it('listar todos cuando no hay categoría', async () => {
    mockRepository.findAll.mockResolvedValue([]);

    await useCase.execute();

    expect(mockRepository.findAll).toHaveBeenCalledWith(undefined);
  });
});

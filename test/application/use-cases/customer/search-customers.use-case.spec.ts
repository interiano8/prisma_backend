import { SearchCustomersUseCase } from '../../../../src/application/use-cases/customer/search-customers.use-case';
import { CustomerRepository } from '../../../../src/domain/ports/out/customer-repository.interface';

describe('SearchCustomersUseCase', () => {
  let useCase: SearchCustomersUseCase;
  let mockRepository: jest.Mocked<CustomerRepository>;

  beforeEach(() => {
    mockRepository = {
      search: jest.fn(),
      findByCode: jest.fn(),
      findByRtn: jest.fn(),
      getConsumidorFinalCode: jest.fn(),
      createCustomer: jest.fn(),
    };
    useCase = new SearchCustomersUseCase(mockRepository);
  });

  it('reenvía query y creditOnly al repositorio', async () => {
    const customers = [
      {
        code: 'C001',
        name: 'Ana',
        rtf: '123',
        phone: '',
        email: '',
        address: '',
      },
    ];
    mockRepository.search.mockResolvedValue(customers);

    const result = await useCase.execute('ana', true);

    expect(mockRepository.search).toHaveBeenCalledWith('ana', true, undefined, undefined);
    expect(result).toEqual(customers);
  });

  it('invoca search sin argumentos cuando no hay filtros', async () => {
    mockRepository.search.mockResolvedValue([]);

    await useCase.execute();

    expect(mockRepository.search).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
  });
});

import { GetCustomerByCodeUseCase } from '../../../../src/application/use-cases/customer/get-customer-by-code.use-case';
import type { CustomerRepository } from '../../../../src/domain/ports/out/customer-repository.interface';

describe('GetCustomerByCodeUseCase', () => {
  let useCase: GetCustomerByCodeUseCase;
  let mockRepo: jest.Mocked<CustomerRepository>;

  beforeEach(() => {
    mockRepo = {
      search: jest.fn(),
      findByCode: jest.fn(),
      findByRtn: jest.fn(),
      getConsumidorFinalCode: jest.fn(),
      createCustomer: jest.fn(),
    };
    useCase = new GetCustomerByCodeUseCase(mockRepo);
  });

  it('busca el cliente por código', async () => {
    mockRepo.findByCode.mockResolvedValue(null);

    expect(await useCase.execute('NOPE')).toBeNull();
    expect(mockRepo.findByCode).toHaveBeenCalledWith('NOPE');
  });

  it('devuelve el cliente encontrado', async () => {
    const customer = {
      code: 'C001',
      name: 'ANA',
      rtf: '0801',
      phone: '',
      email: '',
      address: '',
    };
    mockRepo.findByCode.mockResolvedValue(customer);

    expect(await useCase.execute('C001')).toEqual(customer);
  });
});

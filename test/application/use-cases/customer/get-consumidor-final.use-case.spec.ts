import { GetConsumidorFinalUseCase } from '../../../../src/application/use-cases/customer/get-consumidor-final.use-case';
import { CustomerRepository } from '../../../../src/domain/ports/out/customer-repository.interface';

describe('GetConsumidorFinalUseCase', () => {
  let useCase: GetConsumidorFinalUseCase;
  let mockRepository: jest.Mocked<CustomerRepository>;

  beforeEach(() => {
    mockRepository = {
      search: jest.fn(),
      findByCode: jest.fn(),
      findByRtn: jest.fn(),
      getConsumidorFinalCode: jest.fn(),
      createCustomer: jest.fn(),
    };
    useCase = new GetConsumidorFinalUseCase(mockRepository);
  });

  it('devuelve el consumidor final encontrado por código exacto', async () => {
    const customer = {
      code: 'CF',
      name: 'CONSUMIDOR FINAL',
      rtf: '',
      phone: '',
      email: '',
      address: '',
    };
    mockRepository.getConsumidorFinalCode.mockResolvedValue('CF');
    mockRepository.findByCode.mockResolvedValue(customer);

    const result = await useCase.execute();

    expect(mockRepository.findByCode).toHaveBeenCalledWith('CF');
    expect(mockRepository.search).not.toHaveBeenCalled();
    expect(result).toEqual(customer);
  });

  it('devuelve null cuando no existe código de consumidor final', async () => {
    mockRepository.getConsumidorFinalCode.mockResolvedValue(null);

    expect(await useCase.execute()).toBeNull();
    expect(mockRepository.findByCode).not.toHaveBeenCalled();
  });

  it('devuelve null cuando no existe el cliente por código', async () => {
    mockRepository.getConsumidorFinalCode.mockResolvedValue('CF');
    mockRepository.findByCode.mockResolvedValue(null);

    expect(await useCase.execute()).toBeNull();
  });
});

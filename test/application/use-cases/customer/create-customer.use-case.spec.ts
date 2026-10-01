import { CreateCustomerUseCase } from '../../../../src/application/use-cases/customer/create-customer.use-case';
import type { CustomerRepository } from '../../../../src/domain/ports/out/customer-repository.interface';
import { BadRequestDomainError } from '../../../../src/domain/errors/domain-error';

describe('CreateCustomerUseCase', () => {
  let useCase: CreateCustomerUseCase;
  let mockRepo: jest.Mocked<CustomerRepository>;

  beforeEach(() => {
    mockRepo = {
      search: jest.fn(),
      findByCode: jest.fn(),
      findByRtn: jest.fn(),
      getConsumidorFinalCode: jest.fn(),
      createCustomer: jest.fn(),
    };
    useCase = new CreateCustomerUseCase(mockRepo);
  });

  it('crea el cliente con RTN limpio y nombre en mayúsculas', async () => {
    mockRepo.findByRtn.mockResolvedValue(null);
    mockRepo.createCustomer.mockResolvedValue({
      success: true,
      code: 'C001',
      name: 'ANA LOPEZ',
      rtf: '08011990012345',
    });

    const result = await useCase.execute({
      code: 'C001',
      name: 'ana-lopez',
      rtn: '0801-1990-012345',
    });

    expect(mockRepo.createCustomer).toHaveBeenCalledWith(
      'C001',
      'ANALOPEZ',
      '08011990012345',
    );
    expect(result.success).toBe(true);
  });

  it('genera un código único cuando no se envía uno', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByRtn.mockResolvedValue(null);
    mockRepo.createCustomer.mockResolvedValue({
      success: true,
      code: 'BP-123456',
      name: 'ANA',
      rtf: '0801',
    });

    const result = await useCase.execute({
      name: 'ana',
      rtn: '0801',
    });

    expect(mockRepo.findByCode).toHaveBeenCalled();
    expect(mockRepo.createCustomer.mock.calls[0][0]).toMatch(/^CCO-.*-\d{6}$/);
    expect(result.success).toBe(true);
  });

  it('prefija el código generado con el número de tienda', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByRtn.mockResolvedValue(null);
    mockRepo.createCustomer.mockResolvedValue({
      success: true,
      code: '001-BP-123456',
      name: 'ANA',
      rtf: '0801',
    });

    const result = await useCase.execute({
      name: 'ana',
      rtn: '0801',
      storeId: '001',
    });

    expect(mockRepo.findByCode).toHaveBeenCalled();
    expect(mockRepo.createCustomer.mock.calls[0][0]).toMatch(/^CCO-.*-\d{6}$/);
    expect(result.success).toBe(true);
  });

  it('devuelve exists cuando el RTN ya existe sin allowDuplicateRtn', async () => {
    mockRepo.findByRtn.mockResolvedValue({
      code: 'C9',
      name: 'OTRO',
      rtf: '0801',
      phone: '',
      email: '',
      address: '',
    });

    const result = await useCase.execute({ name: 'ana', rtn: '0801' });

    expect(result.success).toBe(false);
    expect(result.exists).toBe(true);
    expect(result.existingCustomer).toEqual({ code: 'C9', name: 'OTRO' });
    expect(mockRepo.createCustomer).not.toHaveBeenCalled();
  });

  it('crea el cliente aunque el RTN ya exista con allowDuplicateRtn', async () => {
    mockRepo.findByRtn.mockResolvedValue({
      code: 'C9',
      name: 'OTRO',
      rtf: '0801',
      phone: '',
      email: '',
      address: '',
    });
    mockRepo.createCustomer.mockResolvedValue({
      success: true,
      code: 'PRA001-123456',
      name: 'ANA',
      rtf: '0801',
    });

    const result = await useCase.execute({
      name: 'ana',
      rtn: '0801',
      storeId: '001',
      allowDuplicateRtn: true,
    });

    expect(result.success).toBe(true);
    expect(mockRepo.createCustomer).toHaveBeenCalledTimes(1);
  });

  it('reintenta generar un código cuando el generado ya existe', async () => {
    mockRepo.findByCode
      .mockResolvedValueOnce({ code: 'BP-111111' } as never)
      .mockResolvedValueOnce(null);
    mockRepo.findByRtn.mockResolvedValue(null);
    mockRepo.createCustomer.mockResolvedValue({
      success: true,
      code: 'BP-222222',
      name: 'ANA',
      rtf: '0801',
    });

    await useCase.execute({ name: 'ana', rtn: '0801' });

    expect(mockRepo.findByCode).toHaveBeenCalledTimes(2);
    expect(mockRepo.createCustomer).toHaveBeenCalledTimes(1);
  });

  it('envuelve errores de base de datos en BadRequestDomainError', async () => {
    mockRepo.findByRtn.mockResolvedValue(null);
    mockRepo.createCustomer.mockRejectedValue(new Error('DB down'));

    await expect(useCase.execute({ name: 'ana', rtn: '0801' })).rejects.toThrow(
      'Error de base de datos al registrar el cliente.',
    );
  });

  it('relanza BadRequestDomainError proveniente del repositorio', async () => {
    mockRepo.findByRtn.mockResolvedValue(null);
    const original = new BadRequestDomainError('error del repo');
    mockRepo.createCustomer.mockRejectedValue(original);

    await expect(useCase.execute({ name: 'ana', rtn: '0801' })).rejects.toThrow(
      'error del repo',
    );
  });
});

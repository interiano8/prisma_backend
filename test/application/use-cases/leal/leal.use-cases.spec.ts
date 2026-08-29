import { LoginLealUseCase } from '../../../../src/application/use-cases/leal/login-leal.use-case';
import { SearchLealCustomerUseCase } from '../../../../src/application/use-cases/leal/search-leal-customer.use-case';
import { RegisterLealCustomerUseCase } from '../../../../src/application/use-cases/leal/register-leal-customer.use-case';
import { AccumulatePointsUseCase } from '../../../../src/application/use-cases/leal/accumulate-points.use-case';
import { RedeemPointsUseCase } from '../../../../src/application/use-cases/leal/redeem-points.use-case';
import { ReverseTransactionUseCase } from '../../../../src/application/use-cases/leal/reverse-transaction.use-case';
import { CheckLealStatusUseCase } from '../../../../src/application/use-cases/leal/check-leal-status.use-case';
import type { LealRepository } from '../../../../src/domain/ports/out/leal-repository.interface';
import { UnauthorizedDomainError } from '../../../../src/domain/errors/domain-error';

function mockLealRepository(): jest.Mocked<LealRepository> {
  return {
    login: jest.fn(),
    checkStatus: jest.fn(),
    searchCustomer: jest.fn(),
    getPremios: jest.fn(),
    registerCustomer: jest.fn(),
    accumulatePoints: jest.fn(),
    redeemPoints: jest.fn(),
    reverseTransaction: jest.fn(),
    generateOtp: jest.fn(),
    getCredentials: jest.fn(),
    updateCredentials: jest.fn(),
  };
}

describe('LoginLealUseCase', () => {
  let useCase: LoginLealUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new LoginLealUseCase(mockRepository);
  });

  it('hace login delegando en el repositorio', async () => {
    mockRepository.login.mockResolvedValue({
      token: 'leal-token',
      expiresAt: '2026-01-16T08:00:00Z',
    });
    const credentials = {
      username: 'u',
      password: 'p',
      storeId: '001',
    };

    const result = await useCase.execute(credentials);

    expect(mockRepository.login).toHaveBeenCalledWith(credentials);
    expect(result.token).toBe('leal-token');
  });
});

describe('SearchLealCustomerUseCase', () => {
  let useCase: SearchLealCustomerUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new SearchLealCustomerUseCase(mockRepository);
  });

  it('busca al cliente delegando en el repositorio', async () => {
    const customer = {
      uid: 'u1',
      documentId: '0801',
      nombre: 'Ana',
      apellido: 'Lopez',
      fullname: 'Ana Lopez',
      email: 'a@x.com',
      celular: '555',
      puntos: 10,
      status: 'active',
      tier: 'silver',
    };
    mockRepository.searchCustomer.mockResolvedValue(customer);

    const result = await useCase.execute('0801', '0', 'token');

    expect(mockRepository.searchCustomer).toHaveBeenCalledWith(
      '0801',
      '0',
      'token',
    );
    expect(result).toEqual(customer);
  });
});

describe('RegisterLealCustomerUseCase', () => {
  let useCase: RegisterLealCustomerUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new RegisterLealCustomerUseCase(mockRepository);
  });

  it('registra al cliente delegando en el repositorio', async () => {
    const data = {
      documentId: '0801',
      name: 'Ana',
      email: 'a@x.com',
      phone: '555',
      token: 'token',
    };
    mockRepository.registerCustomer.mockResolvedValue({
      documentId: '0801',
      name: 'Ana',
      email: 'a@x.com',
      phone: '555',
      points: 0,
    });

    const result = await useCase.execute(data);

    expect(mockRepository.registerCustomer).toHaveBeenCalledWith(data);
    expect(result.documentId).toBe('0801');
  });
});

describe('AccumulatePointsUseCase', () => {
  let useCase: AccumulatePointsUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new AccumulatePointsUseCase(mockRepository);
  });

  it('acumula puntos delegando en el repositorio', async () => {
    const data = {
      customerId: 'u1',
      invoiceNo: 'F001',
      total: 100,
      token: 'token',
    };
    mockRepository.accumulatePoints.mockResolvedValue({ code: 200, puntos: 5 });

    const result = await useCase.execute(data);

    expect(mockRepository.accumulatePoints).toHaveBeenCalledWith(data);
    expect(result).toEqual({ code: 200, puntos: 5 });
  });
});

describe('RedeemPointsUseCase', () => {
  let useCase: RedeemPointsUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new RedeemPointsUseCase(mockRepository);
  });

  it('redime puntos delegando en el repositorio', async () => {
    const data = {
      customerId: 'u1',
      points: 100,
      invoiceNo: 'F001',
      token: 'token',
    };
    mockRepository.redeemPoints.mockResolvedValue({ code: 200 });

    const result = await useCase.execute(data);

    expect(mockRepository.redeemPoints).toHaveBeenCalledWith(data);
    expect(result).toEqual({ code: 200 });
  });
});

describe('ReverseTransactionUseCase', () => {
  let useCase: ReverseTransactionUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new ReverseTransactionUseCase(mockRepository);
  });

  it('revierte la transacción delegando en el repositorio', async () => {
    mockRepository.reverseTransaction.mockResolvedValue({ code: 200 });

    const result = await useCase.execute('t1', 'F001', 'token');

    expect(mockRepository.reverseTransaction).toHaveBeenCalledWith(
      't1',
      'F001',
      'token',
    );
    expect(result).toEqual({ code: 200 });
  });
});

describe('CheckLealStatusUseCase', () => {
  let useCase: CheckLealStatusUseCase;
  let mockRepository: jest.Mocked<LealRepository>;

  beforeEach(() => {
    mockRepository = mockLealRepository();
    useCase = new CheckLealStatusUseCase(mockRepository);
  });

  it('devuelve el estado cuando hay conexión', async () => {
    mockRepository.checkStatus.mockResolvedValue({
      connected: true,
      idComercio: 'COM1',
    });

    const result = await useCase.execute();

    expect(result).toEqual({ connected: true, idComercio: 'COM1' });
  });

  it('lanza UnauthorizedDomainError cuando no hay conexión', async () => {
    mockRepository.checkStatus.mockResolvedValue({ connected: false });

    await expect(useCase.execute()).rejects.toThrow(UnauthorizedDomainError);
  });
});

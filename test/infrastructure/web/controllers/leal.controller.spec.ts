import { Test, TestingModule } from '@nestjs/testing';
import { LealController } from '../../../../src/infrastructure/web/controllers/leal.controller';
import { LoginLealUseCase } from '../../../../src/application/use-cases/leal/login-leal.use-case';
import { CheckLealStatusUseCase } from '../../../../src/application/use-cases/leal/check-leal-status.use-case';
import { SearchLealCustomerUseCase } from '../../../../src/application/use-cases/leal/search-leal-customer.use-case';
import { AccumulatePointsUseCase } from '../../../../src/application/use-cases/leal/accumulate-points.use-case';
import { RedeemPointsUseCase } from '../../../../src/application/use-cases/leal/redeem-points.use-case';
import { RegisterLealCustomerUseCase } from '../../../../src/application/use-cases/leal/register-leal-customer.use-case';

describe('LealController', () => {
  let controller: LealController;
  let mockUseCases: {
    loginLealUseCase: { execute: jest.Mock };
    checkLealStatusUseCase: { execute: jest.Mock };
    searchLealCustomerUseCase: { execute: jest.Mock };
    accumulatePointsUseCase: { execute: jest.Mock };
    redeemPointsUseCase: { execute: jest.Mock };
    registerLealCustomerUseCase: { execute: jest.Mock };
    lealRepository: {
      getCredentials: jest.Mock;
      updateCredentials: jest.Mock;
      getPremios: jest.Mock;
      generateOtp: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockUseCases = {
      loginLealUseCase: { execute: jest.fn() },
      checkLealStatusUseCase: { execute: jest.fn() },
      searchLealCustomerUseCase: { execute: jest.fn() },
      accumulatePointsUseCase: { execute: jest.fn() },
      redeemPointsUseCase: { execute: jest.fn() },
      registerLealCustomerUseCase: { execute: jest.fn() },
      lealRepository: {
        getCredentials: jest.fn(),
        updateCredentials: jest.fn(),
        getPremios: jest.fn(),
        generateOtp: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LealController],
      providers: [
        { provide: LoginLealUseCase, useValue: mockUseCases.loginLealUseCase },
        {
          provide: CheckLealStatusUseCase,
          useValue: mockUseCases.checkLealStatusUseCase,
        },
        {
          provide: SearchLealCustomerUseCase,
          useValue: mockUseCases.searchLealCustomerUseCase,
        },
        {
          provide: AccumulatePointsUseCase,
          useValue: mockUseCases.accumulatePointsUseCase,
        },
        {
          provide: RedeemPointsUseCase,
          useValue: mockUseCases.redeemPointsUseCase,
        },
        {
          provide: RegisterLealCustomerUseCase,
          useValue: mockUseCases.registerLealCustomerUseCase,
        },
        {
          provide: 'LealRepository',
          useValue: mockUseCases.lealRepository,
        },
      ],
    }).compile();

    controller = module.get<LealController>(LealController);
  });

  it('login llama al use-case con credenciales', async () => {
    mockUseCases.loginLealUseCase.execute.mockResolvedValue({ token: 't' });

    const result = await controller.login({
      username: 'u',
      password: 'p',
      storeId: '001',
    });

    expect(mockUseCases.loginLealUseCase.execute).toHaveBeenCalledWith({
      username: 'u',
      password: 'p',
      storeId: '001',
    });
    expect(result).toEqual({ token: 't' });
  });

  it('status delega en checkStatus', async () => {
    mockUseCases.checkLealStatusUseCase.execute.mockResolvedValue({
      connected: true,
    });

    expect(await controller.checkStatus()).toEqual({ connected: true });
  });

  it('credentials devuelve las credenciales del repositorio', async () => {
    mockUseCases.lealRepository.getCredentials.mockResolvedValue({
      user: 'u',
      pass: 'p',
    });

    expect(await controller.getCredentials()).toEqual({ user: 'u', pass: 'p' });
  });

  it('updateCredentials devuelve éxito', async () => {
    expect(
      await controller.updateCredentials({ user: 'u', pass: 'p' }),
    ).toEqual({ success: true });
    expect(mockUseCases.lealRepository.updateCredentials).toHaveBeenCalledWith(
      'u',
      'p',
    );
  });

  it('searchCustomer usa el token del header y devuelve arreglo', async () => {
    mockUseCases.searchLealCustomerUseCase.execute.mockResolvedValue({
      uid: 'u1',
      documentId: '0801',
      nombre: 'Ana',
      apellido: 'L',
      fullname: 'Ana L',
      email: 'a@x.com',
      celular: '5',
      puntos: 1,
      status: 'active',
      tier: 'silver',
    });

    const result = await controller.searchCustomer('0801', '', 'Bearer abc');

    expect(mockUseCases.searchLealCustomerUseCase.execute).toHaveBeenCalledWith(
      '0801',
      's',
      'abc',
    );
    expect(result).toEqual({ data: [expect.objectContaining({ uid: 'u1' })] });
  });

  it('accumulatePoints normaliza campos', async () => {
    mockUseCases.accumulatePointsUseCase.execute.mockResolvedValue({
      code: 200,
    });

    const result = await controller.accumulatePoints(
      { uid: 'u1', factura: 'F001', valor: 100 },
      'Bearer abc',
    );

    expect(mockUseCases.accumulatePointsUseCase.execute).toHaveBeenCalledWith({
      customerId: 'u1',
      invoiceNo: 'F001',
      total: 100,
      token: 'abc',
    });
    expect(result).toEqual({ code: 200 });
  });

  it('redeemPoints normaliza puntos e idPremio', async () => {
    mockUseCases.redeemPointsUseCase.execute.mockResolvedValue({ code: 200 });

    await controller.redeemPoints(
      {
        customerId: 'u1',
        puntos: 50,
        factura: 'F001',
        id_premio: 7,
        otp: '123',
      },
      'Bearer abc',
    );

    expect(mockUseCases.redeemPointsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'u1',
        points: 50,
        invoiceNo: 'F001',
        idPremio: 7,
        otp: '123',
        token: 'abc',
      }),
    );
  });

  it('generateOtp delega en el repositorio', async () => {
    mockUseCases.lealRepository.generateOtp.mockResolvedValue({ code: 200 });

    await controller.generateOtp({ uid: 'u1', idPremio: 3 });

    expect(mockUseCases.lealRepository.generateOtp).toHaveBeenCalledWith(
      'u1',
      3,
      undefined,
    );
  });

  it('registerCustomer delega en el use-case', async () => {
    mockUseCases.registerLealCustomerUseCase.execute.mockResolvedValue({
      documentId: '0801',
    });

    await controller.registerCustomer(
      { documentId: '0801', name: 'A', email: 'e', phone: '5' },
      'Bearer abc',
    );

    expect(
      mockUseCases.registerLealCustomerUseCase.execute,
    ).toHaveBeenCalledWith({
      documentId: '0801',
      name: 'A',
      email: 'e',
      phone: '5',
      token: 'abc',
    });
  });

  it('searchCustomer usa token vacío sin header de autorización', async () => {
    mockUseCases.searchLealCustomerUseCase.execute.mockResolvedValue(null);

    await controller.searchCustomer('0801', '', undefined);

    expect(mockUseCases.searchLealCustomerUseCase.execute).toHaveBeenCalledWith(
      '0801',
      's',
      '',
    );
  });

  it('getCustomerByUid busca con soloCedula n y devuelve data', async () => {
    mockUseCases.searchLealCustomerUseCase.execute.mockResolvedValue({
      uid: 'u2',
    });

    const result = await controller.getCustomerByUid('u2', 'Bearer abc');

    expect(mockUseCases.searchLealCustomerUseCase.execute).toHaveBeenCalledWith(
      'u2',
      'n',
      'abc',
    );
    expect(result).toEqual({ data: { uid: 'u2' } });
  });

  it('getPremios delega en el repositorio', async () => {
    mockUseCases.lealRepository.getPremios.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ]);

    const result = await controller.getPremios('u2', 'Bearer abc');

    expect(mockUseCases.lealRepository.getPremios).toHaveBeenCalledWith(
      'u2',
      'abc',
    );
    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }] });
  });

  it('login aplica fallbacks con body vacío', async () => {
    mockUseCases.loginLealUseCase.execute.mockResolvedValue({ token: 't' });

    await controller.login({});

    expect(mockUseCases.loginLealUseCase.execute).toHaveBeenCalledWith({
      username: '',
      password: '',
      storeId: '',
    });
  });

  it('accumulatePoints aplica fallbacks con body vacío', async () => {
    mockUseCases.accumulatePointsUseCase.execute.mockResolvedValue({});

    await controller.accumulatePoints({});

    expect(mockUseCases.accumulatePointsUseCase.execute).toHaveBeenCalledWith({
      customerId: '',
      invoiceNo: '',
      total: 0,
      token: '',
    });
  });

  it('redeemPoints aplica fallbacks y variantes id_premio/OTP', async () => {
    mockUseCases.redeemPointsUseCase.execute.mockResolvedValue({});

    await controller.redeemPoints({ id_premio: 7, OTP: '999' }, 'Bearer x');

    expect(mockUseCases.redeemPointsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: '',
        points: 0,
        invoiceNo: '',
        idPremio: 7,
        otp: '999',
        token: 'x',
      }),
    );
  });

  it('generateOtp aplica fallbacks con variantes id_premio/id_sucursal', async () => {
    mockUseCases.lealRepository.generateOtp.mockResolvedValue({});

    await controller.generateOtp({
      id_premio: 3,
      id_sucursal: 'S1',
    });

    expect(mockUseCases.lealRepository.generateOtp).toHaveBeenCalledWith(
      '',
      3,
      'S1',
    );
  });

  it('registerCustomer aplica fallbacks con body vacío', async () => {
    mockUseCases.registerLealCustomerUseCase.execute.mockResolvedValue({});

    await controller.registerCustomer({}, 'Bearer abc');

    expect(
      mockUseCases.registerLealCustomerUseCase.execute,
    ).toHaveBeenCalledWith({
      documentId: '',
      name: '',
      email: '',
      phone: '',
      token: 'abc',
    });
  });
});

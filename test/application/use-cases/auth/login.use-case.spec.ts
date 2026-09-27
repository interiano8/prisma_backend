import { LoginUseCase } from '../../../../src/application/use-cases/auth/login.use-case';
import { AuthRepository } from '../../../../src/domain/ports/out/auth-repository.interface';
import { LoginRequest } from '../../../../src/domain/ports/in/auth-use-case.interface';
import type { TokenPort } from '../../../../src/domain/ports/out/token.interface';
import {
  UnauthorizedDomainError,
  NotFoundDomainError,
} from '../../../../src/domain/errors/domain-error';

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
  let mockAuthRepository: jest.Mocked<AuthRepository>;
  let mockTokenService: { sign: jest.Mock };
  let mockPasswordHasher: { verify: jest.Mock; hash: jest.Mock };

  const validLoginRequest: LoginRequest = {
    username: 'jdoe',
    password: 'correctPassword',
    posNo: 'POS01',
    storeId: '001',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthRepository = {
      findUserByUsername: jest.fn(),
      findUserByRfid: jest.fn(),
      findStoreByStoreId: jest.fn(),
      findStoreRaw: jest.fn(),
      findTpvConfig: jest.fn(),
      findPosConfig: jest.fn(),
      findPassAdmin: jest.fn(),
      updatePassAdmin: jest.fn(),
      checkCreditValidation: jest.fn(),
      getActiveShift: jest.fn(),
      savePreferences: jest.fn(),

      listEmployees: jest.fn(),
    };

    mockTokenService = { sign: jest.fn().mockReturnValue('jwt.real.token') };
    mockPasswordHasher = { verify: jest.fn().mockReturnValue(true), hash: jest.fn() };

    loginUseCase = new LoginUseCase(
      mockAuthRepository,
      mockTokenService as unknown as TokenPort,
      mockPasswordHasher,
    );
  });

  describe('successful login', () => {
    it('should return login response with token on valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
        passwordHash: 'hashedPassword',
        pinLeal: '1234',
      };

      const mockStore = {
        storeId: '001',
        storeName: 'Test Store',
        posNumber: 'POS01',
        rtf: '08019001234567',
        phone: '555-1234',
        email: 'test@store.com',
        address: '123 Main St',
        isGasStation: false,
        isGasController: false,
        ipFusionController: '',
        claveControlador: '',
        isFusionAssigned: false,
        isLealEnabled: false,
        urlLeal: '',
        descuentoManual: false,
        facturarVariasLineas: false,
        screenOnPump: false,
        casaMatriz: 'Test Store',
        name: 'Test Store',
        rtn: '08019001234567',
        country: 'HN',
        state: 'AT',
        city: 'Roatan',
        address1: '123 Main St',
        address2: '',
        address3: '',
        passAdmin: 'adminPass',
        turnos: null,
        d3: '',
        d4: '',
        numberOfTransactionsWaiting: null,
        codeCountry: '504',
        warningNewInvoiceRanges: null,
        warningNewCreditNotesRanges: null,
  urlControlador: '',
        blockedForPendingTransactions: false,
        debugMode: false,
        noConsumidorFinal: 'CF',
        urlSaldo: '',
        validarRFID: false,
        validarSaldoCredito: false,
        voxIsActive: false,
        rangoIndividual: false,
        facturacionOrdenada: false,
        erp: '',
        urlActualizacion: '',
        urlBaseERP: '',
        turnoManual: false,
        calculoInverso: false,
        campanas: false,
        nombreBotonFidelizacion: 'LEAL',
        caras: [],
      };

      const mockShiftInfo = {
        Shift: '1',
        'POS Transaction ID': 'TX123',
        'Shift Starting': '2026-01-15T08:00:00Z',
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(true);
      mockAuthRepository.findStoreByStoreId.mockResolvedValue(mockStore);
      mockAuthRepository.getActiveShift.mockResolvedValue(mockShiftInfo);

      const result = await loginUseCase.execute(validLoginRequest);

      expect(result.user).toEqual({
        id: 1,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
        pinLeal: '1234',
        preferencias: null,
        roles: ['ADMIN'],
        permissions: [],
      });
      expect(mockTokenService.sign).toHaveBeenCalledWith({
        sub: 1,
        username: 'jdoe',
        profile: 'ADMIN',
        roles: ['ADMIN'],
        permissions: [],
      });
      expect(result.token).toBe('jwt.real.token');
      expect(result.storeConfig).toEqual(mockStore);
      expect(result.shiftInfo).toEqual(mockShiftInfo);
    });

    it('should default profile to CAJERO if user has no profile', async () => {
      const mockUser = {
        id: 2,
        username: 'cashier',
        name: 'Cashier User',
        profile: '',
        isActive: true,
        passwordHash: 'hash',
        pinLeal: '',
      };

      const mockStore = {
        storeId: '001',
        storeName: 'Store',
        posNumber: 'POS01',
        rtf: '',
        phone: '',
        email: '',
        address: '',
        isGasStation: false,
        isGasController: false,
        ipFusionController: '',
        claveControlador: '',
        isFusionAssigned: false,
        isLealEnabled: false,
        urlLeal: '',
        descuentoManual: false,
        facturarVariasLineas: false,
        screenOnPump: false,
        casaMatriz: '',
        name: '',
        rtn: '',
        country: '',
        state: '',
        city: '',
        address1: '',
        address2: '',
        address3: '',
        passAdmin: '',
        turnos: null,
        d3: '',
        d4: '',
        numberOfTransactionsWaiting: null,
        codeCountry: '',
        warningNewInvoiceRanges: null,
        warningNewCreditNotesRanges: null,
  urlControlador: '',
        blockedForPendingTransactions: false,
        debugMode: false,
        noConsumidorFinal: '',
        urlSaldo: '',
        validarRFID: false,
        validarSaldoCredito: false,
        voxIsActive: false,
        rangoIndividual: false,
        facturacionOrdenada: false,
        erp: '',
        urlActualizacion: '',
        urlBaseERP: '',
        turnoManual: false,
        calculoInverso: false,
        campanas: false,
        nombreBotonFidelizacion: 'LEAL',
        caras: [],
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(true);
      mockAuthRepository.findStoreByStoreId.mockResolvedValue(mockStore);
      mockAuthRepository.getActiveShift.mockResolvedValue({
        Shift: null,
        Message: 'No open shift found',
      });

      const result = await loginUseCase.execute(validLoginRequest);

      expect(result.user.profile).toBe('CAJERO');
    });

    it('should handle null shift info', async () => {
      const mockUser = {
        id: 3,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
        passwordHash: 'hash',
        pinLeal: '',
      };

      const mockStore = {
        storeId: '001',
        storeName: 'Store',
        posNumber: 'POS01',
        rtf: '',
        phone: '',
        email: '',
        address: '',
        isGasStation: false,
        isGasController: false,
        ipFusionController: '',
        claveControlador: '',
        isFusionAssigned: false,
        isLealEnabled: false,
        urlLeal: '',
        descuentoManual: false,
        facturarVariasLineas: false,
        screenOnPump: false,
        casaMatriz: '',
        name: '',
        rtn: '',
        country: '',
        state: '',
        city: '',
        address1: '',
        address2: '',
        address3: '',
        passAdmin: '',
        turnos: null,
        d3: '',
        d4: '',
        numberOfTransactionsWaiting: null,
        codeCountry: '',
        warningNewInvoiceRanges: null,
        warningNewCreditNotesRanges: null,
  urlControlador: '',
        blockedForPendingTransactions: false,
        debugMode: false,
        noConsumidorFinal: '',
        urlSaldo: '',
        validarRFID: false,
        validarSaldoCredito: false,
        voxIsActive: false,
        rangoIndividual: false,
        facturacionOrdenada: false,
        erp: '',
        urlActualizacion: '',
        urlBaseERP: '',
        turnoManual: false,
        calculoInverso: false,
        campanas: false,
        nombreBotonFidelizacion: 'LEAL',
        caras: [],
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(true);
      mockAuthRepository.findStoreByStoreId.mockResolvedValue(mockStore);
      mockAuthRepository.getActiveShift.mockResolvedValue({
        Shift: null,
        Message: 'No open shift found',
      });

      const result = await loginUseCase.execute(validLoginRequest);

      expect(result.shiftInfo).toEqual({
        Message: 'No open shift found',
        Shift: null,
      });
    });
  });

  describe('invalid password', () => {
    it('should throw UnauthorizedDomainError when password is wrong', async () => {
      const mockUser = {
        id: 1,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
        passwordHash: 'hashedPassword',
        pinLeal: '',
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(false);

      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        UnauthorizedDomainError,
      );
      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        'Usuario o contraseña incorrectos',
      );
    });

    it('should throw UnauthorizedDomainError when user has empty passwordHash', async () => {
      const mockUser = {
        id: 1,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
        passwordHash: '',
        pinLeal: '',
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(false);

      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        UnauthorizedDomainError,
      );
    });
  });

  describe('user not found', () => {
    it('should throw UnauthorizedDomainError when user does not exist', async () => {
      mockAuthRepository.findUserByUsername.mockResolvedValue(null);

      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        UnauthorizedDomainError,
      );
      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        'Usuario o contraseña incorrectos',
      );
    });
  });

  describe('inactive user', () => {
    it('should throw UnauthorizedDomainError when user is inactive', async () => {
      const mockUser = {
        id: 1,
        username: 'inactive_user',
        name: 'Inactive User',
        profile: 'CAJERO',
        isActive: false,
        passwordHash: 'hash',
        pinLeal: '',
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);

      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        UnauthorizedDomainError,
      );
      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        'El usuario se encuentra inactivo',
      );
    });
  });

  describe('store not found', () => {
    it('should throw NotFoundDomainError when store config not found', async () => {
      const mockUser = {
        id: 1,
        username: 'jdoe',
        name: 'John Doe',
        profile: 'ADMIN',
        isActive: true,
        passwordHash: 'hash',
        pinLeal: '',
      };

      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(true);
      mockAuthRepository.findStoreByStoreId.mockResolvedValue(null);

      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        NotFoundDomainError,
      );
      await expect(loginUseCase.execute(validLoginRequest)).rejects.toThrow(
        'Configuración de tienda no encontrada',
      );
    });
  });

  describe('configuración del POS', () => {
    const mockUser = {
      id: 1,
      username: 'jdoe',
      name: 'John Doe',
      profile: 'ADMIN',
      isActive: true,
      passwordHash: 'hash',
      pinLeal: '',
    };
    const mockStore = {
      storeId: '001',
      posNumber: 'POS01',
    } as never;

    beforeEach(() => {
      mockAuthRepository.findUserByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockReturnValue(true);
      mockAuthRepository.findStoreByStoreId.mockResolvedValue(mockStore);
      mockAuthRepository.getActiveShift.mockResolvedValue(null as never);
    });

    it('aplica los valores de la configuración del POS cuando existe', async () => {
      mockAuthRepository.findPosConfig.mockResolvedValue({
        mostrarBombas: true,
        ocultarBotonOtrasBombas: true,
        numTransaccionesBombas: 42,
        minutosAtrasada: 7,
        mostrarTeclado: false,
        declararMontosIniciales: true,
        caras: [3, 4],
      });

      const result = await loginUseCase.execute(validLoginRequest);

      expect(result.storeConfig.mostrarBombas).toBe(true);
      expect(result.storeConfig.ocultarBotonOtrasBombas).toBe(true);
      expect(result.storeConfig.numTransaccionesBombas).toBe(42);
      expect(result.storeConfig.minutosAtrasada).toBe(7);
      expect(result.storeConfig.mostrarTeclado).toBe(false);
      expect(result.storeConfig.declararMontosIniciales).toBe(true);
      expect(result.storeConfig.caras).toEqual([3, 4]);
    });

    it('aplica valores por defecto cuando no hay configuración del POS', async () => {
      mockAuthRepository.findPosConfig.mockResolvedValue(null);

      const result = await loginUseCase.execute(validLoginRequest);

      expect(result.storeConfig.mostrarBombas).toBe(false);
      expect(result.storeConfig.ocultarBotonOtrasBombas).toBe(false);
      expect(result.storeConfig.numTransaccionesBombas).toBe(20);
      expect(result.storeConfig.minutosAtrasada).toBe(10);
      expect(result.storeConfig.mostrarTeclado).toBe(true);
      expect(result.storeConfig.declararMontosIniciales).toBe(false);
    });
  });
});

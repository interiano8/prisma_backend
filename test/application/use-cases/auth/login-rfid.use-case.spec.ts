import { LoginRfidUseCase } from '../../../../src/application/use-cases/auth/login-rfid.use-case';
import { AuthRepository } from '../../../../src/domain/ports/out/auth-repository.interface';
import { LoginRfidRequest } from '../../../../src/domain/ports/in/auth-use-case.interface';
import type { TokenPort } from '../../../../src/domain/ports/out/token.interface';
import {
  UnauthorizedDomainError,
  NotFoundDomainError,
} from '../../../../src/domain/errors/domain-error';

describe('LoginRfidUseCase', () => {
  let useCase: LoginRfidUseCase;
  let mockAuthRepository: jest.Mocked<AuthRepository>;
  let mockTokenService: { sign: jest.Mock };

  const request: LoginRfidRequest = {
    rfidCode: 'RFID-001',
    storeId: '001',
    posNo: 'POS01',
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

    mockTokenService = { sign: jest.fn().mockReturnValue('jwt.rfid.token') };

    useCase = new LoginRfidUseCase(
      mockAuthRepository,
      mockTokenService as unknown as TokenPort,
    );
  });

  it('devuelve la sesión y firma un token para un usuario RFID válido', async () => {
    mockAuthRepository.findUserByRfid.mockResolvedValue({
      id: 7,
      username: 'rfid_user',
      name: 'RFID User',
      profile: 'CAJERO',
      isActive: true,
      passwordHash: 'hash',
      pinLeal: '4321',
    });
    mockAuthRepository.findStoreByStoreId.mockResolvedValue({
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
    });
    mockAuthRepository.findPosConfig.mockResolvedValue(null);
    mockAuthRepository.getActiveShift.mockResolvedValue({
      Shift: '1',
      'POS Transaction ID': 'TX1',
      'Shift Starting': '2026-01-15T08:00:00Z',
    });

    const result = await useCase.execute(request);

    expect(result.user.username).toBe('rfid_user');
    expect(result.token).toBe('jwt.rfid.token');
    expect(mockTokenService.sign).toHaveBeenCalledWith({
      sub: 7,
      username: 'rfid_user',
      profile: 'CAJERO',
      roles: ['CAJERO'],
      permissions: [],
    });
    expect(result.storeConfig.posNumber).toBe('POS01');
  });

  it('lanza UnauthorizedDomainError cuando el RFID no está registrado', async () => {
    mockAuthRepository.findUserByRfid.mockResolvedValue(null);

    await expect(useCase.execute(request)).rejects.toThrow(
      UnauthorizedDomainError,
    );
    await expect(useCase.execute(request)).rejects.toThrow(
      'Tarjeta RFID no registrada o inválida',
    );
    expect(mockTokenService.sign).not.toHaveBeenCalled();
  });

  it('lanza NotFoundDomainError cuando la tienda no existe', async () => {
    mockAuthRepository.findUserByRfid.mockResolvedValue({
      id: 1,
      username: 'u',
      name: 'U',
      profile: 'CAJERO',
      isActive: true,
      passwordHash: 'h',
      pinLeal: '',
    });
    mockAuthRepository.findStoreByStoreId.mockResolvedValue(null);

    await expect(useCase.execute(request)).rejects.toThrow(NotFoundDomainError);
    await expect(useCase.execute(request)).rejects.toThrow(
      'Configuración de tienda no encontrada',
    );
  });

  it('aplica valores por defecto de configuración del POS cuando no hay config', async () => {
    mockAuthRepository.findUserByRfid.mockResolvedValue({
      id: 1,
      username: 'u',
      name: 'U',
      profile: 'CAJERO',
      isActive: true,
      passwordHash: 'h',
      pinLeal: '',
    });
    mockAuthRepository.findStoreByStoreId.mockResolvedValue({
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
    });
    mockAuthRepository.findPosConfig.mockResolvedValue(null);
    mockAuthRepository.getActiveShift.mockResolvedValue({
      Shift: null,
      Message: 'No open shift found',
    });

    const result = await useCase.execute(request);

    expect(result.storeConfig.mostrarBombas).toBe(false);
    expect(result.storeConfig.numTransaccionesBombas).toBe(20);
    expect(result.storeConfig.minutosAtrasada).toBe(10);
    expect(result.storeConfig.mostrarTeclado).toBe(true);
    expect(result.shiftInfo).toEqual({
      Message: 'No open shift found',
      Shift: null,
    });
  });

  it('aplica valores por defecto del perfil, PIN y shiftInfo nulo', async () => {
    mockAuthRepository.findUserByRfid.mockResolvedValue({
      id: 1,
      username: 'u',
      name: 'U',
      profile: '',
      isActive: true,
      passwordHash: 'h',
      pinLeal: '',
    });
    mockAuthRepository.findStoreByStoreId.mockResolvedValue({
      storeId: '001',
      posNumber: 'POS01',
    } as never);
    mockAuthRepository.findPosConfig.mockResolvedValue(null);
    mockAuthRepository.getActiveShift.mockResolvedValue(null as never);

    const result = await useCase.execute(request);

    expect(result.user.profile).toBe('CAJERO');
    expect(result.user.pinLeal).toBe('');
    expect(result.shiftInfo).toEqual({
      Message: 'No open shift found',
      Shift: null,
    });
  });

  it('aplica la configuración del POS cuando existe', async () => {
    mockAuthRepository.findUserByRfid.mockResolvedValue({
      id: 1,
      username: 'u',
      name: 'U',
      profile: 'CAJERO',
      isActive: true,
      passwordHash: 'h',
      pinLeal: '',
    });
    mockAuthRepository.findStoreByStoreId.mockResolvedValue({
      storeId: '001',
      posNumber: 'POS01',
    } as never);
    mockAuthRepository.findPosConfig.mockResolvedValue({
      mostrarBombas: true,
      ocultarBotonOtrasBombas: true,
      numTransaccionesBombas: 42,
      minutosAtrasada: 7,
      mostrarTeclado: false,
      declararMontosIniciales: true,
      caras: [],
    });
    mockAuthRepository.getActiveShift.mockResolvedValue(null as never);

    const result = await useCase.execute(request);

    expect(result.storeConfig.mostrarBombas).toBe(true);
    expect(result.storeConfig.ocultarBotonOtrasBombas).toBe(true);
    expect(result.storeConfig.numTransaccionesBombas).toBe(42);
    expect(result.storeConfig.minutosAtrasada).toBe(7);
    expect(result.storeConfig.mostrarTeclado).toBe(false);
    expect(result.storeConfig.declararMontosIniciales).toBe(true);
  });
});

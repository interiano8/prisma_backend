import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../../../src/infrastructure/web/controllers/auth.controller';
import { LoginUseCase } from '../../../../src/application/use-cases/auth/login.use-case';
import { LoginBackofficeUseCase } from '../../../../src/application/use-cases/auth/login-backoffice.use-case';
import { LoginRfidUseCase } from '../../../../src/application/use-cases/auth/login-rfid.use-case';
import { ValidateAdminUseCase } from '../../../../src/application/use-cases/auth/validate-admin.use-case';
import { UpdateAdminPasswordUseCase } from '../../../../src/application/use-cases/auth/update-admin-password.use-case';
import { CheckCreditValidationUseCase } from '../../../../src/application/use-cases/auth/check-credit-validation.use-case';
import { SavePreferencesUseCase } from '../../../../src/application/use-cases/auth/save-preferences.use-case';
import { LoginDto } from '../../../../src/infrastructure/web/dto/auth/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../src/infrastructure/web/guards/jwt-auth.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { TOKEN_PORT } from '../../../../src/domain/ports/out/token.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let mockLoginUseCase: { execute: jest.Mock };
  let mockLoginRfidUseCase: { execute: jest.Mock };
  let mockValidateAdmin: { execute: jest.Mock };
  let mockUpdateAdminPassword: { execute: jest.Mock };
  let mockCheckCredit: { execute: jest.Mock };
  let mockSavePreferences: { execute: jest.Mock };
  let mockLoginBackofficeUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    mockLoginUseCase = { execute: jest.fn() };
    mockLoginRfidUseCase = { execute: jest.fn() };
    mockValidateAdmin = { execute: jest.fn() };
    mockUpdateAdminPassword = { execute: jest.fn() };
    mockCheckCredit = { execute: jest.fn() };
    mockSavePreferences = { execute: jest.fn() };
    mockLoginBackofficeUseCase = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: mockLoginUseCase },
        { provide: LoginRfidUseCase, useValue: mockLoginRfidUseCase },
        { provide: LoginBackofficeUseCase, useValue: mockLoginBackofficeUseCase },
        { provide: ValidateAdminUseCase, useValue: mockValidateAdmin },
        { provide: UpdateAdminPasswordUseCase, useValue: mockUpdateAdminPassword },
        { provide: CheckCreditValidationUseCase, useValue: mockCheckCredit },
        { provide: SavePreferencesUseCase, useValue: mockSavePreferences },
        {
          provide: TOKEN_PORT,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        {
          provide: 'AuthRepository',
          useValue: { listEmployees: jest.fn().mockResolvedValue([]) },
        },
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/login', () => {
    const validDto: LoginDto = {
      username: 'jdoe',
      password: 'correctPassword',
      posNo: 'POS01',
      storeId: '001',
    };

    it('should delegate to LoginUseCase with the DTO data', async () => {
      const loginResponse = { user: { id: 1 }, token: 'jwt-token-for-jdoe' };
      mockLoginUseCase.execute.mockResolvedValue(loginResponse);

      const result = await controller.login(validDto);

      expect(mockLoginUseCase.execute).toHaveBeenCalledWith({
        username: 'jdoe',
        password: 'correctPassword',
        storeId: '001',
        posNo: 'POS01',
      });
      expect(result).toEqual(loginResponse);
    });

    it('should propagate UnauthorizedException on invalid credentials', async () => {
      mockLoginUseCase.execute.mockRejectedValue(
        new UnauthorizedException('Usuario o contraseña incorrectos'),
      );

      await expect(controller.login(validDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.login(validDto)).rejects.toThrow(
        'Usuario o contraseña incorrectos',
      );
    });
  });

  describe('PUT /auth/preferences', () => {
    it('should save preferences via the use-case', async () => {
      mockSavePreferences.execute.mockResolvedValue({ success: true });

      const result = await controller.savePreferences({
        username: 'jdoe',
        theme: 'dark',
        accent: '#0070f3',
      });

      expect(mockSavePreferences.execute).toHaveBeenCalledWith('jdoe', {
        theme: 'dark',
        accent: '#0070f3',
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('POST /auth/validate-admin', () => {
    it('delega en el use-case', async () => {
      mockValidateAdmin.execute.mockResolvedValue({ valid: true });

      await controller.validateAdmin({ storeId: '001', password: 'x' });

      expect(mockValidateAdmin.execute).toHaveBeenCalledWith({
        storeId: '001',
        password: 'x',
      });
    });
  });

  describe('PUT /auth/admin-password', () => {
    it('delega en el use-case', async () => {
      mockUpdateAdminPassword.execute.mockResolvedValue({ ok: true });

      await controller.updateAdminPassword({
        storeId: '001',
        currentPassword: 'admin123',
        newPassword: 'nueva123',
      });

      expect(mockUpdateAdminPassword.execute).toHaveBeenCalledWith({
        storeId: '001',
        currentPassword: 'admin123',
        newPassword: 'nueva123',
      });
    });
  });

  describe('GET /auth/check-credit-validation/:storeId', () => {
    it('delega en el use-case', async () => {
      mockCheckCredit.execute.mockResolvedValue({ validarSaldoCredito: true });

      await controller.checkCreditValidation('001');

      expect(mockCheckCredit.execute).toHaveBeenCalledWith('001');
    });
  });

  describe('GET /auth/employees', () => {
    it('delega en el repositorio', async () => {
      const res = await controller.listEmployees();
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe('POST /auth/backoffice', () => {
    it('delega la contraseña en el use-case', async () => {
      mockLoginBackofficeUseCase.execute.mockReturnValue({
        token: 't',
        profile: 'ADMIN',
      });

      const res = await controller.loginBackoffice({ password: 'clave' });

      expect(res).toEqual({ token: 't', profile: 'ADMIN' });
      expect(mockLoginBackofficeUseCase.execute).toHaveBeenCalledWith('clave');
    });

    it('envía cadena vacía si falta la contraseña', async () => {
      mockLoginBackofficeUseCase.execute.mockReturnValue({ token: 't', profile: 'ADMIN' });
      await controller.loginBackoffice({});
      expect(mockLoginBackofficeUseCase.execute).toHaveBeenCalledWith('');
    });
  });

  describe('POST /auth/login-rfid', () => {
    it('delega en el use-case', async () => {
      mockLoginRfidUseCase.execute.mockResolvedValue({ employee: { name: 'A' } });

      const res = await controller.loginRfid({
        rfidCode: 'RF1',
        storeId: '001',
        posNo: '01',
      });

      expect(res).toEqual({ employee: { name: 'A' } });
      expect(mockLoginRfidUseCase.execute).toHaveBeenCalledWith({
        rfidCode: 'RF1',
        storeId: '001',
        posNo: '01',
      });
    });
  });
});

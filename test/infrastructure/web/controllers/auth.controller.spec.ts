import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../../../src/infrastructure/web/controllers/auth.controller';
import { LoginUseCase } from '../../../../src/application/use-cases/auth/login.use-case';
import { LoginRfidUseCase } from '../../../../src/application/use-cases/auth/login-rfid.use-case';
import { ValidateAdminUseCase } from '../../../../src/application/use-cases/auth/validate-admin.use-case';
import { CheckCreditValidationUseCase } from '../../../../src/application/use-cases/auth/check-credit-validation.use-case';
import { SavePreferencesUseCase } from '../../../../src/application/use-cases/auth/save-preferences.use-case';
import { LoginDto } from '../../../../src/infrastructure/web/dto/auth/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../src/infrastructure/web/guards/jwt-auth.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { TOKEN_PORT } from '../../../../src/infrastructure/security/tokens';

describe('AuthController', () => {
  let controller: AuthController;
  let mockLoginUseCase: { execute: jest.Mock };
  let mockLoginRfidUseCase: { execute: jest.Mock };
  let mockValidateAdmin: { execute: jest.Mock };
  let mockCheckCredit: { execute: jest.Mock };
  let mockSavePreferences: { execute: jest.Mock };

  beforeEach(async () => {
    mockLoginUseCase = { execute: jest.fn() };
    mockLoginRfidUseCase = { execute: jest.fn() };
    mockValidateAdmin = { execute: jest.fn() };
    mockCheckCredit = { execute: jest.fn() };
    mockSavePreferences = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: mockLoginUseCase },
        { provide: LoginRfidUseCase, useValue: mockLoginRfidUseCase },
        { provide: ValidateAdminUseCase, useValue: mockValidateAdmin },
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

  describe('GET /auth/check-credit-validation/:storeId', () => {
    it('delega en el use-case', async () => {
      mockCheckCredit.execute.mockResolvedValue({ validarSaldoCredito: true });

      await controller.checkCreditValidation('001');

      expect(mockCheckCredit.execute).toHaveBeenCalledWith('001');
    });
  });
});

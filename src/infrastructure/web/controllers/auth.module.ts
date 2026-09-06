import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepositoryImpl } from '../../persistence/repositories/auth-repository';
import { TokenService } from '../../security/token.service';
import { IdentityPasswordHasher } from '../../security/password-hasher';
import { LoginUseCase } from '../../../application/use-cases/auth/login.use-case';
import { LoginRfidUseCase } from '../../../application/use-cases/auth/login-rfid.use-case';
import { ValidateAdminUseCase } from '../../../application/use-cases/auth/validate-admin.use-case';
import { UpdateAdminPasswordUseCase } from '../../../application/use-cases/auth/update-admin-password.use-case';
import { LoginBackofficeUseCase } from '../../../application/use-cases/auth/login-backoffice.use-case';
import { CheckCreditValidationUseCase } from '../../../application/use-cases/auth/check-credit-validation.use-case';
import { SavePreferencesUseCase } from '../../../application/use-cases/auth/save-preferences.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PASSWORD_HASHER_PORT } from '../../security/tokens'
import { TOKEN_PORT } from '../../../domain/ports/out/token.interface';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: TOKEN_PORT, useClass: TokenService },
    { provide: PASSWORD_HASHER_PORT, useClass: IdentityPasswordHasher },
    JwtAuthGuard,
    { provide: 'AuthRepository', useClass: AuthRepositoryImpl },
    {
      provide: LoginUseCase,
      useFactory: (
        repo: AuthRepository,
        tokenService: TokenService,
        passwordHasher: IdentityPasswordHasher,
      ) => new LoginUseCase(repo, tokenService, passwordHasher),
      inject: ['AuthRepository', TOKEN_PORT, PASSWORD_HASHER_PORT],
    },
    {
      provide: LoginRfidUseCase,
      useFactory: (repo: AuthRepository, tokenService: TokenService) =>
        new LoginRfidUseCase(repo, tokenService),
      inject: ['AuthRepository', TOKEN_PORT],
    },
    {
      provide: ValidateAdminUseCase,
      useFactory: (
        repo: AuthRepository,
        passwordHasher: IdentityPasswordHasher,
      ) => new ValidateAdminUseCase(repo, passwordHasher),
      inject: ['AuthRepository', PASSWORD_HASHER_PORT],
    },
    {
      provide: UpdateAdminPasswordUseCase,
      useFactory: (
        repo: AuthRepository,
        passwordHasher: IdentityPasswordHasher,
      ) => new UpdateAdminPasswordUseCase(repo, passwordHasher),
      inject: ['AuthRepository', PASSWORD_HASHER_PORT],
    },
    {
      provide: CheckCreditValidationUseCase,
      useFactory: (repo: AuthRepository) =>
        new CheckCreditValidationUseCase(repo),
      inject: ['AuthRepository'],
    },
    {
      provide: SavePreferencesUseCase,
      useFactory: (repo: AuthRepository) => new SavePreferencesUseCase(repo),
      inject: ['AuthRepository'],
    },
    {
      provide: LoginBackofficeUseCase,
      useFactory: (tokenService: TokenService) =>
        new LoginBackofficeUseCase(tokenService),
      inject: [TOKEN_PORT],
    },
  ],
  exports: ['AuthRepository', LoginUseCase, LoginRfidUseCase, ValidateAdminUseCase],
})
export class AuthModule {}

import { LoginBackofficeUseCase } from './login-backoffice.use-case';
import { TOKEN_PORT } from '../../../domain/ports/out/token.interface';
import { UnauthorizedDomainError } from '../../../domain/errors/domain-error';

describe('LoginBackofficeUseCase', () => {
  const tokenService = { sign: jest.fn(() => 'token-back') };

  beforeEach(() => {
    process.env.BACKOFFICE_PASSWORD = 'back-secret';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.BACKOFFICE_PASSWORD;
    delete process.env.ADMIN_MASTER_PASSWORD;
  });

  it('genera token ADMIN con la llave correcta', () => {
    const useCase = new LoginBackofficeUseCase(tokenService as any);

    const result = useCase.execute('back-secret');

    expect(result).toEqual({ token: 'token-back', profile: 'ADMIN' });
    expect(tokenService.sign).toHaveBeenCalledWith({
      sub: 0,
      username: 'backoffice',
      profile: 'ADMIN',
    });
  });

  it('usa ADMIN_MASTER_PASSWORD como fallback de llave', () => {
    delete process.env.BACKOFFICE_PASSWORD;
    process.env.ADMIN_MASTER_PASSWORD = 'master-secret';
    const useCase = new LoginBackofficeUseCase(tokenService as any);

    expect(useCase.execute('master-secret').profile).toBe('ADMIN');
  });

  it('rechaza contraseña incorrecta', () => {
    const useCase = new LoginBackofficeUseCase(tokenService as any);

    expect(() => useCase.execute('wrong')).toThrow(UnauthorizedDomainError);
    expect(tokenService.sign).not.toHaveBeenCalled();
  });

  it('rechaza si no hay llave configurada', () => {
    delete process.env.BACKOFFICE_PASSWORD;
    delete process.env.ADMIN_MASTER_PASSWORD;
    const useCase = new LoginBackofficeUseCase(tokenService as any);

    expect(() => useCase.execute('x')).toThrow(UnauthorizedDomainError);
  });
});
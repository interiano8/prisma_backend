import * as jwt from 'jsonwebtoken';
import { TokenService } from '../../../src/infrastructure/security/token.service';
import { UnauthorizedDomainError } from '../../../src/domain/errors/domain-error';

describe('TokenService', () => {
  let service: TokenService;
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    service = new TokenService();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('firma un token con expiración de 8h', () => {
    const payload = { sub: 1, username: 'jdoe', profile: 'ADMIN' };

    const token = service.sign(payload);
    const decoded = jwt.verify(token, 'test-secret') as jwt.JwtPayload;

    expect(decoded.sub).toBe(1);
    expect(decoded.username).toBe('jdoe');
    expect(decoded.profile).toBe('ADMIN');
    expect(decoded.exp! - decoded.iat!).toBe(8 * 60 * 60);
  });

  it('verifica un token válido y devuelve el payload', () => {
    const token = jwt.sign(
      { sub: 2, username: 'ana', profile: 'CAJERO' },
      'test-secret',
    );

    expect(service.verify(token)).toEqual({
      sub: 2,
      username: 'ana',
      profile: 'CAJERO',
      iat: expect.any(Number),
    });
  });

  it('rechaza un token con payload mal formado', () => {
    const token = jwt.sign({ sub: '2', username: 123 }, 'test-secret');

    expect(() => service.verify(token)).toThrow(UnauthorizedDomainError);
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = jwt.sign(
      { sub: 1, username: 'jdoe', profile: 'ADMIN' },
      'otro-secreto',
    );

    expect(() => service.verify(token)).toThrow(UnauthorizedDomainError);
  });

  it('rechaza un token malformado', () => {
    expect(() => service.verify('no-es-un-jwt')).toThrow(
      UnauthorizedDomainError,
    );
  });

  it('lanza error al firmar sin JWT_SECRET configurado', () => {
    delete process.env.JWT_SECRET;

    expect(() => service.sign({ sub: 1, username: 'x', profile: 'y' })).toThrow(
      'JWT_SECRET no está configurado en el entorno',
    );
  });

  it('lanza UnauthorizedDomainError al verificar sin JWT_SECRET configurado', () => {
    delete process.env.JWT_SECRET;

    expect(() => service.verify('token')).toThrow(UnauthorizedDomainError);
  });
});

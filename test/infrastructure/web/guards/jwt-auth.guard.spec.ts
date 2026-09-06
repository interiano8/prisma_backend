import {
  JwtAuthGuard,
  AuthenticatedRequest,
} from '../../../../src/infrastructure/web/guards/jwt-auth.guard';
import type { TokenPort } from '../../../../src/domain/ports/out/token.interface';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UnauthorizedDomainError } from '../../../../src/domain/errors/domain-error';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockTokenService: { verify: jest.Mock; hash: jest.Mock };

  beforeEach(() => {
    mockTokenService = { verify: jest.fn(), hash: jest.fn() };
    guard = new JwtAuthGuard(mockTokenService as unknown as TokenPort);
  });

  function buildContext(authorization?: string): ExecutionContext {
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('permite el acceso con un Bearer token válido', () => {
    const payload = { sub: 1, username: 'jdoe', profile: 'ADMIN' };
    mockTokenService.verify.mockReturnValue(payload);
    const context = buildContext('Bearer valid-token');

    expect(guard.canActivate(context)).toBe(true);
    expect(mockTokenService.verify).toHaveBeenCalledWith('valid-token');
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    expect(request.user).toEqual(payload);
  });

  it('rechaza cuando no hay cabecera Authorization', () => {
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza cuando el esquema no es Bearer', () => {
    expect(() => guard.canActivate(buildContext('Basic abc123'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza cuando el token es inválido', () => {
    mockTokenService.verify.mockImplementation(() => {
      throw new UnauthorizedDomainError('Token inválido o expirado');
    });
    expect(() => guard.canActivate(buildContext('Bearer bad-token'))).toThrow(
      UnauthorizedDomainError,
    );
  });
});

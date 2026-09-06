import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('AdminGuard', () => {
  const ctxFor = (profile: string | null) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: profile ? { profile } : null }),
      }),
    }) as any;

  beforeEach(() => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deniega si el guard base falla', () => {
    (JwtAuthGuard.prototype.canActivate as jest.Mock).mockReturnValue(false);
    const guard = new AdminGuard({ sign: jest.fn() } as any);

    expect(guard.canActivate(ctxFor(null))).toBe(false);
  });

  it('lanza Forbidden si el usuario no es ADMIN', () => {
    const guard = new AdminGuard({ sign: jest.fn() } as any);

    expect(() => guard.canActivate(ctxFor('OPERADOR'))).toThrow(
      ForbiddenException,
    );
  });

  it('permite cuando el usuario es ADMIN', () => {
    const guard = new AdminGuard({ sign: jest.fn() } as any);

    expect(guard.canActivate(ctxFor('ADMIN'))).toBe(true);
  });
});
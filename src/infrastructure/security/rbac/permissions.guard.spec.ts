import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

describe('PermissionsGuard (prisma_backend)', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('permite el acceso si la ruta no requiere permisos específicos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ username: 'cajero1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza ForbiddenException si el usuario no está autenticado', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sales:cancel']);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permite acceso irrestricto si el usuario tiene rol o perfil ADMIN / SUPER_ADMIN', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sales:cancel', 'users:manage']);
    const contextAdmin = createMockContext({
      username: 'admin',
      profile: 'ADMIN',
      roles: ['ADMIN'],
      permissions: [],
    });

    expect(guard.canActivate(contextAdmin)).toBe(true);
  });

  it('permite el acceso si el usuario posee todos los permisos requeridos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sales:create', 'sales:reprint']);
    const context = createMockContext({
      username: 'cajero1',
      profile: 'CAJERO',
      roles: ['CAJERO'],
      permissions: ['sales:create', 'sales:reprint', 'shifts:open'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('bloquea y lista los permisos faltantes si el usuario carece de alguno', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sales:create', 'sales:cancel']);
    const context = createMockContext({
      username: 'cajero1',
      profile: 'CAJERO',
      roles: ['CAJERO'],
      permissions: ['sales:create'],
    });

    expect(() => guard.canActivate(context)).toThrow(
      'Acceso denegado. Permisos requeridos faltantes: sales:cancel',
    );
  });
});

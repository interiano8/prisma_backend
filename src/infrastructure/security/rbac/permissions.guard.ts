import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { AuthenticatedRequest } from '../../web/guards/jwt-auth.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    // Perfil o roles de ADMIN / SUPER_ADMIN tienen bypass total
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles
      : user.profile
        ? [user.profile]
        : [];

    if (
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN') ||
      user.profile === 'ADMIN' ||
      user.profile === 'SUPER_ADMIN'
    ) {
      return true;
    }

    const userPermissions: string[] = Array.isArray(user.permissions)
      ? user.permissions
      : [];

    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAll) {
      const missing = requiredPermissions.filter(
        (p) => !userPermissions.includes(p),
      );
      throw new ForbiddenException(
        `Acceso denegado. Permisos requeridos faltantes: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}

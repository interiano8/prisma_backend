import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class AdminGuard extends JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!super.canActivate(context)) return false;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const isAdmin =
      user?.profile === 'ADMIN' ||
      user?.profile === 'SUPER_ADMIN' ||
      roles.includes('ADMIN') ||
      roles.includes('SUPER_ADMIN');

    if (!isAdmin) {
      throw new ForbiddenException(
        'Se requiere un usuario con perfil ADMIN para esta operación',
      );
    }
    return true;
  }
}
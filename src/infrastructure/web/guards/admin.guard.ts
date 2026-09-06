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
    if (request.user?.profile !== 'ADMIN') {
      throw new ForbiddenException(
        'Se requiere un usuario con perfil ADMIN para esta operación',
      );
    }
    return true;
  }
}
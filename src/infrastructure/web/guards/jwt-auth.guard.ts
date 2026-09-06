import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import type {
  TokenPort,
  TokenPayload,
} from '../../../domain/ports/out/token.interface';
import { TOKEN_PORT } from '../../../domain/ports/out/token.interface';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_PORT) private readonly tokenService: TokenPort) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'No se proporcionó un token de autenticación',
      );
    }
    const token = authHeader.slice('Bearer '.length);
    request.user = this.tokenService.verify(token);
    return true;
  }
}

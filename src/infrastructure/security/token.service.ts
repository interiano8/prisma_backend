import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type {
  TokenPort,
  TokenPayload,
} from '../../domain/ports/out/token.interface';
import { UnauthorizedDomainError } from '../../domain/errors/domain-error';

const JWT_SECRET_ENV = 'JWT_SECRET';
const TOKEN_TTL = '8h';

@Injectable()
export class TokenService implements TokenPort {
  private get secret(): string {
    const secret = process.env[JWT_SECRET_ENV];
    if (!secret) {
      throw new Error('JWT_SECRET no está configurado en el entorno');
    }
    return secret;
  }

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: TOKEN_TTL });
  }

  verify(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, this.secret) as unknown as TokenPayload;
      if (
        typeof payload.sub !== 'number' ||
        typeof payload.username !== 'string' ||
        typeof payload.profile !== 'string'
      ) {
        throw new Error('payload inválido');
      }
      return payload;
    } catch {
      throw new UnauthorizedDomainError('Token inválido o expirado');
    }
  }
}

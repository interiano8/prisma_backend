import { Inject, Injectable } from '@nestjs/common';
import type { TokenPort, TokenPayload } from '../../../domain/ports/out/token.interface';
import { TOKEN_PORT } from '../../../domain/ports/out/token.interface';
import { UnauthorizedDomainError } from '../../../domain/errors/domain-error';

@Injectable()
export class LoginBackofficeUseCase {
  private readonly key =
    process.env.BACKOFFICE_PASSWORD || process.env.ADMIN_MASTER_PASSWORD;

  constructor(@Inject(TOKEN_PORT) private readonly tokenService: TokenPort) {}

  execute(password: string): { token: string; profile: string } {
    if (!this.key || !password || password !== this.key) {
      throw new UnauthorizedDomainError('Llave de backoffice inválida');
    }
    const payload: TokenPayload = {
      sub: 0,
      username: 'backoffice',
      profile: 'ADMIN',
    };
    return { token: this.tokenService.sign(payload), profile: 'ADMIN' };
  }
}
import { Injectable } from '@nestjs/common';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';
import type { PasswordHasherPort } from '../../../domain/ports/out/password-hasher.interface';
import { UnauthorizedDomainError } from '../../../domain/errors/domain-error';

@Injectable()
export class ValidateAdminUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(dto: { storeId: string; password: string }) {
    const masterPassword = process.env.ADMIN_MASTER_PASSWORD;
    if (masterPassword && dto.password === masterPassword) {
      return { valid: true };
    }
    const passAdmin = await this.authRepository.findPassAdmin(dto.storeId);
    if (!passAdmin) throw new UnauthorizedDomainError('Contraseña Invalida');
    if (!this.passwordHasher.verify(passAdmin, dto.password))
      throw new UnauthorizedDomainError('Contraseña Invalida');
    return { valid: true };
  }
}

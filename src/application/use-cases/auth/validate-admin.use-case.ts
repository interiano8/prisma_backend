import { Injectable } from '@nestjs/common';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';
import type { PasswordHasherPort } from '../../../domain/ports/out/password-hasher.interface';
import { UnauthorizedDomainError } from '../../../domain/errors/domain-error';

@Injectable()
export class ValidateAdminUseCase {
  // Llave de emergencia opcional (por entorno), no en el código.
  private readonly masterPassword = process.env.ADMIN_MASTER_PASSWORD;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(dto: { storeId: string; password: string }) {
    if (this.masterPassword && dto.password === this.masterPassword) {
      return { valid: true };
    }
    const passAdmin = await this.authRepository.findPassAdmin(dto.storeId);
    if (!passAdmin) throw new UnauthorizedDomainError('Contraseña Invalida');
    if (!this.passwordHasher.verify(passAdmin, dto.password))
      throw new UnauthorizedDomainError('Contraseña Invalida');
    return { valid: true };
  }
}
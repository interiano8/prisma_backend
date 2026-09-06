import { Injectable } from '@nestjs/common';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';
import type { PasswordHasherPort } from '../../../domain/ports/out/password-hasher.interface';
import {
  BadRequestDomainError,
  UnauthorizedDomainError,
} from '../../../domain/errors/domain-error';

@Injectable()
export class UpdateAdminPasswordUseCase {
  // Llave de emergencia opcional por entorno (no en el código).
  private readonly masterPassword = process.env.ADMIN_MASTER_PASSWORD;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(dto: {
    storeId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const isMaster = dto.currentPassword === this.masterPassword;
    const passAdmin = await this.authRepository.findPassAdmin(dto.storeId);
    const valid =
      isMaster ||
      (!!passAdmin && this.passwordHasher.verify(passAdmin, dto.currentPassword));
    if (!valid) throw new UnauthorizedDomainError('Contraseña Invalida');

    const pwd = String(dto.newPassword || '').trim();
    if (pwd.length < 4)
      throw new BadRequestDomainError(
        'La nueva contraseña debe tener al menos 4 caracteres',
      );

    const hash = this.passwordHasher.hash(pwd);
    await this.authRepository.updatePassAdmin(dto.storeId, hash);
    return { ok: true };
  }
}
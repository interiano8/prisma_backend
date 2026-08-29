import { Injectable } from '@nestjs/common';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';

@Injectable()
export class CheckCreditValidationUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(storeId: string) {
    const valid = await this.authRepository.checkCreditValidation(storeId);
    return { validarSaldoCredito: valid };
  }
}

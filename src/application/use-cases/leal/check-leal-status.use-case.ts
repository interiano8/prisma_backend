import { Injectable } from '@nestjs/common';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';
import { UnauthorizedDomainError } from '../../../domain/errors/domain-error';

@Injectable()
export class CheckLealStatusUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(): Promise<{ connected: boolean; idComercio?: any }> {
    const status = await this.lealRepository.checkStatus();
    if (!status.connected) {
      throw new UnauthorizedDomainError(
        'No se pudo establecer conexión con Leal',
      );
    }
    return status;
  }
}

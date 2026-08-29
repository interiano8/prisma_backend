import { Injectable } from '@nestjs/common';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';
import { LealLoginResponse } from '../../../domain/entities/leal-transaction.entity';

@Injectable()
export class LoginLealUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(credentials: {
    username: string;
    password: string;
    storeId: string;
  }): Promise<LealLoginResponse> {
    return this.lealRepository.login(credentials);
  }
}

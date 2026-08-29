import { Injectable } from '@nestjs/common';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';
import { LealCustomer } from '../../../domain/entities/leal-transaction.entity';

@Injectable()
export class RegisterLealCustomerUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(data: {
    documentId: string;
    name: string;
    email: string;
    phone: string;
    token: string;
  }): Promise<LealCustomer> {
    return this.lealRepository.registerCustomer(data);
  }
}

import { Injectable } from '@nestjs/common';
import type { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import { Customer } from '../../../domain/entities/customer.entity';

@Injectable()
export class GetConsumidorFinalUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(): Promise<Customer | null> {
    const code = await this.customerRepository.getConsumidorFinalCode();
    if (!code) return null;
    return this.customerRepository.findByCode(code);
  }
}

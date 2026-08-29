import { Injectable } from '@nestjs/common';
import type { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import { Customer } from '../../../domain/entities/customer.entity';

@Injectable()
export class GetCustomerByCodeUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(code: string): Promise<Customer | null> {
    return this.customerRepository.findByCode(code);
  }
}

import { Injectable } from '@nestjs/common';
import type { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import { Customer } from '../../../domain/entities/customer.entity';

@Injectable()
export class SearchCustomersUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(
    query?: string,
    creditOnly?: boolean,
    page?: number,
    pageSize?: number,
  ): Promise<
    | Customer[]
    | { total: number; page: number; pageSize: number; data: Customer[] }
  > {
    return this.customerRepository.search(query, creditOnly, page, pageSize);
  }
}

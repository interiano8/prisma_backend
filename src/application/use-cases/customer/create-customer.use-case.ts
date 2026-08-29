import { Injectable } from '@nestjs/common';
import type { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import { Customer } from '../../../domain/entities/customer.entity';
import { BadRequestDomainError } from '../../../domain/errors/domain-error';

export interface CreateCustomerCommand {
  rtn: string;
  name: string;
  code?: string;
  storeId?: string;
  allowDuplicateRtn?: boolean;
}

export interface CreateCustomerResult {
  success: boolean;
  code: string;
  name: string;
  rtf: string;
  exists?: boolean;
  existingCustomer?: { code: string; name: string } | null;
}

@Injectable()
export class CreateCustomerUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(dto: CreateCustomerCommand): Promise<CreateCustomerResult> {
    const cleanRtn = dto.rtn.trim().replace(/-/g, '').replace(/\s+/g, '');
    const cleanName = dto.name.trim().replace(/-/g, '').toUpperCase();
    const storePrefix = dto.storeId ? `PRA${dto.storeId.trim()}` : 'BP';
    const generateRandomCode = () =>
      storePrefix +
      '-' +
      Math.floor(100000 + Math.random() * 900000).toString();
    let customerCode = dto.code ? dto.code.trim() : '';

    if (!customerCode) {
      let isUnique = false;
      while (!isUnique) {
        customerCode = generateRandomCode();
        const existingCode =
          await this.customerRepository.findByCode(customerCode);
        if (!existingCode) {
          isUnique = true;
        }
      }
    }

    const existing: Customer | null =
      await this.customerRepository.findByRtn(cleanRtn);
    if (existing && !dto.allowDuplicateRtn) {
      return {
        success: false,
        code: '',
        name: '',
        rtf: '',
        exists: true,
        existingCustomer: { code: existing.code, name: existing.name },
      };
    }

    try {
      return await this.customerRepository.createCustomer(
        customerCode,
        cleanName,
        cleanRtn,
      );
    } catch (err) {
      if (err instanceof BadRequestDomainError) throw err;
      throw new BadRequestDomainError(
        'Error de base de datos al registrar el cliente.',
      );
    }
  }
}

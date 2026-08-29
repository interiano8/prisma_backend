import { Injectable } from '@nestjs/common';
import type {
  LealRepository,
  LealCustomerResult,
} from '../../../domain/ports/out/leal-repository.interface';

@Injectable()
export class SearchLealCustomerUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(
    documentId: string,
    soloCedula: string,
    token: string,
  ): Promise<LealCustomerResult | null> {
    return this.lealRepository.searchCustomer(documentId, soloCedula, token);
  }
}

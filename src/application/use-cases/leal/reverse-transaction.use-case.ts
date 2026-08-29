import { Injectable } from '@nestjs/common';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';

@Injectable()
export class ReverseTransactionUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(
    transactionId: string,
    invoiceNo: string,
    token: string,
  ): Promise<any> {
    return this.lealRepository.reverseTransaction(
      transactionId,
      invoiceNo,
      token,
    );
  }
}

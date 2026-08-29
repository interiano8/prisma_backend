import { Injectable } from '@nestjs/common';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';

@Injectable()
export class AccumulatePointsUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(data: {
    customerId: string;
    invoiceNo: string;
    total: number;
    token: string;
    totales?: any;
  }): Promise<any> {
    return this.lealRepository.accumulatePoints(data);
  }
}

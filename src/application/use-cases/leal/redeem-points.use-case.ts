import { Injectable } from '@nestjs/common';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';

@Injectable()
export class RedeemPointsUseCase {
  constructor(private readonly lealRepository: LealRepository) {}

  async execute(data: {
    customerId: string;
    points: number;
    invoiceNo: string;
    token: string;
    idPremio?: number;
    otp?: string;
    pin?: string;
    nota?: string;
  }): Promise<any> {
    return this.lealRepository.redeemPoints(data);
  }
}

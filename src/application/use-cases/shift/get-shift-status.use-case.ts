import { Injectable } from '@nestjs/common';
import type { ShiftRepository } from '../../../domain/ports/out/shift-repository.interface';
import { ShiftInfo } from '../../../domain/entities/shift.entity';
import { toServerIso } from '../../../utils/datetime';

@Injectable()
export class GetShiftStatusUseCase {
  constructor(private readonly shiftRepository: ShiftRepository) {}

  async execute(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<ShiftInfo> {
    const result = await this.shiftRepository.findOpenShiftFromDb(
      storeId,
      posNo,
      employeeName,
    );
    if (result && !result.Message && !result.message) {
      return {
        Shift: result.Shift || result.shift || '1',
        'POS Transaction ID':
          result['POS Transaction ID'] ||
          result.posTransactionId ||
          'TX-DEFAULT',
        'Shift Starting':
          result['Shift Starting'] ||
          result.shiftStarting ||
          toServerIso(new Date()),
      };
    }
    const local = await this.shiftRepository.findOpenShift(
      storeId,
      posNo,
      employeeName,
    );
    if (local) {
      return {
        Shift: local.shiftNumber,
        'POS Transaction ID': local.posTransactionId || 'TX-DEFAULT',
        'Shift Starting': toServerIso(local.shiftStarting),
      };
    }
    return {
      Message: 'No open shift found',
      Shift: null,
      'POS Transaction ID': '',
      'Shift Starting': '',
    };
  }
}

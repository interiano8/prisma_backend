import { Injectable } from '@nestjs/common';
import type { ShiftRepository } from '../../../domain/ports/out/shift-repository.interface';
import {
  OpenShiftCommand,
  ShiftInfo,
} from '../../../domain/entities/shift.entity';
import { toServerIso } from '../../../utils/datetime';
import {
  BadRequestDomainError,
  InternalDomainError,
} from '../../../domain/errors/domain-error';

@Injectable()
export class OpenShiftUseCase {
  constructor(private readonly shiftRepository: ShiftRepository) {}

  async execute(dto: OpenShiftCommand): Promise<ShiftInfo> {
    try {
      const existing = await this.shiftRepository.findOpenShift(
        dto.storeId,
        dto.posNo,
        dto.employeeName,
      );
      if (existing) {
        throw new BadRequestDomainError(
          'Ya existe un turno abierto para este empleado en la estación',
        );
      }
      const shift = await this.shiftRepository.createShift(dto);

      return {
        Shift: shift.shiftNumber,
        'POS Transaction ID': shift.posTransactionId,
        'Shift Starting': toServerIso(shift.shiftStarting),
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestDomainError) throw err;
      const msg =
        err instanceof Error
          ? err.message
          : (JSON.stringify(err) ?? 'error desconocido');
      throw new InternalDomainError(`Error al abrir turno: ${msg}`);
    }
  }
}

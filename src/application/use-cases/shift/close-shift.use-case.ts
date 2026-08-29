import { Injectable } from '@nestjs/common';
import type { ShiftRepository } from '../../../domain/ports/out/shift-repository.interface';
import { CloseShiftCommand } from '../../../domain/entities/shift.entity';
import { NotFoundDomainError } from '../../../domain/errors/domain-error';

@Injectable()
export class CloseShiftUseCase {
  constructor(private readonly shiftRepository: ShiftRepository) {}

  async execute(dto: CloseShiftCommand): Promise<{ success: boolean }> {
    const existing = await this.shiftRepository.findOpenShift(
      dto.storeId,
      dto.posNo,
      dto.employeeName,
    );
    if (!existing) {
      throw new NotFoundDomainError(
        'No hay un turno abierto para este empleado',
      );
    }
    return this.shiftRepository.closeShift(dto);
  }
}

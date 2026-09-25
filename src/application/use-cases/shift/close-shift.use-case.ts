import { Inject, Injectable } from '@nestjs/common';
import type { ShiftRepository } from '../../../domain/ports/out/shift-repository.interface';
import type { DispenserRepository } from '../../../domain/ports/out/dispenser-repository.interface';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';
import { CloseShiftCommand } from '../../../domain/entities/shift.entity';
import {
  NotFoundDomainError,
  BadRequestDomainError,
} from '../../../domain/errors/domain-error';

@Injectable()
export class CloseShiftUseCase {
  constructor(
    private readonly shiftRepository: ShiftRepository,
    @Inject('DispenserRepository')
    private readonly dispenserRepo: DispenserRepository,
    @Inject('StoreConfigRepository')
    private readonly storeConfigRepo: StoreConfigRepository,
  ) {}

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

    await this.validatePendientes(dto);

    return this.shiftRepository.closeShift(dto);
  }

  /**
   * Validaciones previas al cierre:
   * - Caso 1 (tiendas.bloqueado_transacciones_bomba): pendientes en las caras del POS.
   * - Caso 2 (tiendas.bloqueado_transacciones_turno): pendientes en los turnos de
   *   Fusion de las ventas del turno (sin importar la cara).
   */
  private async validatePendientes(
    dto: CloseShiftCommand,
  ): Promise<void> {
    const caras: string[] = [];
    const ventas: string[] = [];

    const blockedBomba =
      await this.storeConfigRepo.findBlockedForPendingBomba(dto.storeId);
    if (blockedBomba) {
      const pending = await this.dispenserRepo.getPendingSalesForPos(dto.posNo);
      if (pending.length > 0) {
        const hoses = await this.dispenserRepo.getHoseConfigs();
        const gradeByHose = new Map<string, string>();
        for (const h of hoses) {
          gradeByHose.set(
            `${h.pumpId}:${h.hosePhysicalId}`,
            h.gradeName || '',
          );
        }
        const labels = new Set<string>();
        for (const p of pending) {
          const grade = gradeByHose.get(`${p.PumpNumber}:${p.HoseId}`) ?? '';
          labels.add(
            `Bomba ${p.PumpNumber}${grade ? ` · ${grade}` : ''}`,
          );
        }
        caras.push(...labels);
      }
    }

    const blockedTurno =
      await this.storeConfigRepo.findBlockedForPendingTurno(dto.storeId);
    if (blockedTurno) {
      const saleIds = await this.shiftRepository.getOpenShiftSaleIds(
        dto.storeId,
        dto.posNo,
        dto.employeeName,
      );
      if (saleIds.length > 0) {
        const { pendientes } =
          await this.dispenserRepo.getPendingSalesByUserShifts(saleIds);
        for (const p of pendientes) {
          ventas.push(`Venta #${p.saleId} · turno ${p.shiftId}`);
        }
      }
    }

    if (caras.length > 0 || ventas.length > 0) {
      throw new BadRequestDomainError(
        'Existen ventas de combustible sin facturar antes de cerrar el turno.',
        { caras, ventas },
      );
    }
  }
}
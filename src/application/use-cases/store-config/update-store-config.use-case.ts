import { Injectable } from '@nestjs/common';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';

@Injectable()
export class UpdateStoreConfigUseCase {
  constructor(private readonly storeConfigRepository: StoreConfigRepository) {}

  async execute(
    storeId: string,
    partial: { moneda?: string; carpetaMultimedia?: string },
  ): Promise<{ storeId: string; moneda: string; carpetaMultimedia?: string }> {
    const updates: { moneda?: string; carpetaMultimedia?: string } = {};
    if (partial.moneda !== undefined) {
      updates.moneda = partial.moneda.trim() || 'L.';
    }
    if (partial.carpetaMultimedia !== undefined) {
      updates.carpetaMultimedia = partial.carpetaMultimedia.trim();
    }
    const config = await this.storeConfigRepository.update(storeId, updates);
    return {
      storeId: config.storeId,
      moneda: config.moneda || 'L.',
      carpetaMultimedia: config.carpetaMultimedia,
    };
  }
}

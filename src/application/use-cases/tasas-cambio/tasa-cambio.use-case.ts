import { Inject, Injectable } from '@nestjs/common';
import type { TasaCambioRepository } from '../../../domain/ports/out/tasa-cambio-repository.interface';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';

@Injectable()
export class TasaCambioUseCase {
  constructor(
    @Inject('TasaCambioRepository')
    private readonly repo: TasaCambioRepository,
    @Inject('StoreConfigRepository')
    private readonly storeConfigRepo: StoreConfigRepository,
  ) {}

  async latest() {
    const hoy = new Date().toISOString().split('T')[0];
    const tasa = await this.storeConfigRepo.findExchangeRate(hoy);
    return { tasa };
  }

  list() {
    return this.repo.list();
  }

  create(body: any) {
    return this.repo.create({
      tasa: Number(body?.tasa),
      fecha: body?.fecha ? new Date(body.fecha) : undefined,
    });
  }

  update(id: string, body: any) {
    return this.repo.update(Number(id), {
      ...(body?.tasa != null ? { tasa: Number(body.tasa) } : {}),
      ...(body?.fecha != null ? { fecha: new Date(body.fecha) } : {}),
    });
  }

  delete(id: string) {
    return this.repo.delete(Number(id));
  }
}
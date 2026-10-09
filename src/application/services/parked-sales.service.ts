import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type {
  ParkedSalesRepository,
  VentaAparcadaData,
  CreateVentaAparcadaInput,
} from '../../domain/ports/out/parked-sales-repository.interface';

@Injectable()
export class ParkedSalesService {
  constructor(
    @Inject('ParkedSalesRepository')
    private readonly repo: ParkedSalesRepository,
  ) {}

  async parkSale(input: CreateVentaAparcadaInput): Promise<VentaAparcadaData> {
    return this.repo.create(input);
  }

  async listActive(storeId: string): Promise<VentaAparcadaData[]> {
    return this.repo.listActive(storeId);
  }

  async resumeSale(id: string): Promise<VentaAparcadaData> {
    const sale = await this.repo.findById(id);
    if (!sale) {
      throw new NotFoundException(`No se encontró la venta aparcada #${id}`);
    }
    if (sale.estado !== 'PARKED') {
      throw new ConflictException(
        `La venta aparcada ${sale.codigo} ya no está disponible (estado actual: ${sale.estado}).`,
      );
    }
    return this.repo.markResumed(id);
  }

  async discardSale(id: string): Promise<VentaAparcadaData> {
    const sale = await this.repo.findById(id);
    if (!sale) {
      throw new NotFoundException(`No se encontró la venta aparcada #${id}`);
    }
    return this.repo.markDiscarded(id);
  }

  async expireShiftSales(
    storeId: string,
    usuario: string,
    turnoId: string,
  ): Promise<number> {
    return this.repo.expirePendingByShift(storeId, usuario, turnoId);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ParkedSalesRepository,
  VentaAparcadaData,
  CreateVentaAparcadaInput,
} from '../../../domain/ports/out/parked-sales-repository.interface';

@Injectable()
export class ParkedSalesRepositoryImpl implements ParkedSalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow(row: any): VentaAparcadaData {
    return {
      id: row.id,
      codigo: row.codigo,
      storeId: row.storeId,
      posNo: row.posNo,
      usuario: row.usuario,
      turnoId: row.turnoId,
      cliente: row.cliente,
      items: (row.items as any[]) || [],
      nota: row.nota,
      total: Number(row.total) || 0,
      estado: row.estado,
      fechaCreacion: row.fechaCreacion,
      fechaActualizado: row.fechaActualizado,
    };
  }

  async create(input: CreateVentaAparcadaInput): Promise<VentaAparcadaData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Contar ventas aparcadas del día en la tienda para generar el correlativo A-N
    const countToday = await this.prisma.ventaAparcada.count({
      where: {
        storeId: input.storeId,
        fechaCreacion: { gte: today },
      },
    });

    const codigo = `A-${countToday + 1}`;

    const created = await this.prisma.ventaAparcada.create({
      data: {
        codigo,
        storeId: input.storeId,
        posNo: input.posNo,
        usuario: input.usuario,
        turnoId: input.turnoId,
        cliente: input.cliente ?? undefined,
        items: input.items,
        nota: input.nota || null,
        total: input.total,
        estado: 'PARKED',
      },
    });

    return this.mapRow(created);
  }

  async listActive(storeId: string): Promise<VentaAparcadaData[]> {
    const rows = await this.prisma.ventaAparcada.findMany({
      where: {
        storeId,
        estado: 'PARKED',
      },
      orderBy: { fechaCreacion: 'desc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<VentaAparcadaData | null> {
    const row = await this.prisma.ventaAparcada.findUnique({
      where: { id },
    });
    return row ? this.mapRow(row) : null;
  }

  async markResumed(id: string): Promise<VentaAparcadaData> {
    const updated = await this.prisma.ventaAparcada.update({
      where: { id },
      data: { estado: 'RESUMED' },
    });
    return this.mapRow(updated);
  }

  async markDiscarded(id: string): Promise<VentaAparcadaData> {
    const updated = await this.prisma.ventaAparcada.update({
      where: { id },
      data: { estado: 'DISCARDED' },
    });
    return this.mapRow(updated);
  }

  async expirePendingByShift(
    storeId: string,
    usuario: string,
    turnoId: string,
  ): Promise<number> {
    const res = await this.prisma.ventaAparcada.updateMany({
      where: {
        storeId,
        usuario,
        turnoId,
        estado: 'PARKED',
      },
      data: {
        estado: 'EXPIRED',
      },
    });
    return res.count;
  }
}

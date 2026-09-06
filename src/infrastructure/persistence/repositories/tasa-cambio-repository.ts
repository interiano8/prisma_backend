import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  TasaCambioRepository,
  TasaCambioRow,
} from '../../../domain/ports/out/tasa-cambio-repository.interface';

@Injectable()
export class TasaCambioRepositoryImpl implements TasaCambioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(r: {
    id: number;
    tasa: unknown;
    fecha: Date | null;
  }): TasaCambioRow {
    return { id: r.id, tasa: Number(r.tasa), fecha: r.fecha };
  }

  async list(): Promise<TasaCambioRow[]> {
    const rows = await this.prisma.tasaCambio.findMany({
      orderBy: { fecha: 'desc' },
    });
    return rows.map((r) => this.map(r));
  }

  async create(data: { tasa: number; fecha?: Date }): Promise<TasaCambioRow> {
    const r = await this.prisma.tasaCambio.create({
      data: { tasa: data.tasa, fecha: data.fecha ?? new Date() },
    });
    return this.map(r);
  }

  async update(
    id: number,
    data: { tasa?: number; fecha?: Date },
  ): Promise<TasaCambioRow> {
    const r = await this.prisma.tasaCambio.update({
      where: { id },
      data: {
        ...(data.tasa !== undefined ? { tasa: data.tasa } : {}),
        ...(data.fecha !== undefined ? { fecha: data.fecha } : {}),
      },
    });
    return this.map(r);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.tasaCambio.delete({ where: { id } });
  }
}
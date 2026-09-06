import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  SerieRow,
  SerieWrite,
  SeriesRepository,
} from '../../../domain/ports/out/series-repository.interface';

function trailingNum(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Devuelve el correlativo previo (inicio − 1): el "último usado" antes de
 *  usar el rango. Preserva prefijo y relleno de ceros. */
function decrementNum(s: string): string {
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) return s;
  const num = parseInt(m[2], 10);
  const len = m[2].length;
  const next = Math.max(0, num - 1)
    .toString()
    .padStart(len, '0');
  return m[1] + next;
}

@Injectable()
export class SeriesRepositoryImpl implements SeriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId?: string, posNo?: string): Promise<SerieRow[]> {
    const now = new Date();
    const rows = await this.prisma.serieDocumento.findMany({
      where: {
        ...(storeId ? { idTienda: storeId } : {}),
        ...(posNo ? { codigoPos: posNo } : {}),
      },
      orderBy: [{ codigoSerie: 'asc' }, { codigoPos: 'asc' }, { numeroLinea: 'asc' }],
    });
    return rows.map((r) => ({
      numeroLinea: r.numeroLinea,
      codigoSerie: r.codigoSerie,
      idTienda: r.idTienda,
      codigoPos: r.codigoPos,
      fechaInicio: r.fechaInicio,
      numeroInicio: r.numeroInicio,
      numeroFin: r.numeroFin,
      numeroAviso: r.numeroAviso,
      incremento: r.incremento,
      ultimoNumeroUsado: r.ultimoNumeroUsado,
      abierta: r.abierta,
      cai: r.cai,
      rangoDesde: r.rangoDesde,
      rangoHasta: r.rangoHasta,
      fechaVenceRango: r.fechaVenceRango,
      enEdicion: r.enEdicion,
      remaining: Math.max(
        0,
        trailingNum(r.numeroFin) - trailingNum(r.ultimoNumeroUsado),
      ),
      remainingDays: r.fechaVenceRango
        ? Math.max(
            0,
            Math.floor(
              (r.fechaVenceRango.getTime() - now.getTime()) / 86400000,
            ),
          )
        : 0,
    }));
  }

  async create(data: SerieWrite): Promise<{ numeroLinea: number }> {
    const max = await this.prisma.serieDocumento.aggregate({
      _max: { numeroLinea: true },
      where: { codigoSerie: data.codigoSerie },
    });
    const numeroLinea = (max._max.numeroLinea ?? 0) + 1000;
    const row = await this.prisma.serieDocumento.create({
      data: {
        numeroLinea,
        codigoSerie: data.codigoSerie,
        idTienda: data.idTienda,
        codigoPos: data.codigoPos,
        fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : new Date(),
        numeroInicio: data.numeroInicio,
        numeroFin: data.numeroFin,
        numeroAviso: data.numeroAviso != null ? String(data.numeroAviso) : null,
        incremento: data.incremento ?? 1,
        ultimoNumeroUsado:
          data.ultimoNumeroUsado ?? decrementNum(data.numeroInicio),
        abierta: true,
        cai: data.cai ?? null,
        rangoDesde: data.rangoDesde ?? null,
        rangoHasta: data.rangoHasta ?? null,
        fechaVenceRango: data.fechaVenceRango
          ? new Date(data.fechaVenceRango)
          : null,
        enEdicion: false,
      },
    });
    return { numeroLinea: row.numeroLinea };
  }

  async update(
    numeroLinea: number,
    codigoSerie: string,
    data: Partial<SerieWrite>,
  ): Promise<void> {
    await this.prisma.serieDocumento.update({
      where: { numeroLinea_codigoSerie: { numeroLinea, codigoSerie } },
      data: {
        ...(data.numeroInicio !== undefined
          ? { numeroInicio: data.numeroInicio }
          : {}),
        ...(data.numeroFin !== undefined
          ? { numeroFin: data.numeroFin }
          : {}),
        ...(data.numeroAviso !== undefined
          ? { numeroAviso: String(data.numeroAviso) }
          : {}),
        ...(data.cai !== undefined ? { cai: data.cai } : {}),
        ...(data.fechaVenceRango !== undefined
          ? {
              fechaVenceRango: data.fechaVenceRango
                ? new Date(data.fechaVenceRango)
                : null,
            }
          : {}),
        ...(data.abierta !== undefined ? { abierta: data.abierta } : {}),
        enEdicion: false,
      },
    });
  }

  async close(numeroLinea: number, codigoSerie: string): Promise<void> {
    await this.prisma.serieDocumento.update({
      where: { numeroLinea_codigoSerie: { numeroLinea, codigoSerie } },
      data: { abierta: false },
    });
  }

  async setEditing(
    numeroLinea: number,
    codigoSerie: string,
    editing: boolean,
  ): Promise<void> {
    await this.prisma.serieDocumento.update({
      where: { numeroLinea_codigoSerie: { numeroLinea, codigoSerie } },
      data: { enEdicion: editing },
    });
  }
}
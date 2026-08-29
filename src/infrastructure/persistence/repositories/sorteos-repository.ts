import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SorteosRepository,
  SorteoCondition,
  ActiveSorteo,
  ItemCategoryRow,
} from '../../../domain/ports/out/sorteos-repository.interface';

@Injectable()
export class SorteosRepositoryImpl implements SorteosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSorteos(): Promise<ActiveSorteo[]> {
    try {
      const now = new Date();
      const rows = await this.prisma.sorteo.findMany({
        where: {
          activo: true,
          fechaInicio: { lte: now },
          fechaFin: { gte: now },
        },
      });
      return rows.map((r) => ({
        SorteoID: r.id,
        Nombre: r.nombre || '',
        TextoTicket: r.textoTicket,
      }));
    } catch {
      return [];
    }
  }

  async getFuelCodes(): Promise<string[]> {
    try {
      const rows = await this.prisma.manguera.findMany({
        distinct: ['codigoPos'],
        select: { codigoPos: true },
      });
      return rows
        .map((r) => (r.codigoPos || '').trim().toUpperCase())
        .filter((c) => c);
    } catch {
      return [];
    }
  }

  async getItemCategories(codes: string[]): Promise<ItemCategoryRow[]> {
    if (codes.length === 0) return [];
    try {
      const rows = await this.prisma.producto.findMany({
        where: { codigo: { in: codes } },
        select: { codigo: true, codigoCategoria: true },
      });
      return rows.map((r) => ({
        No_: r.codigo,
        'Item Category Code': r.codigoCategoria || '',
      }));
    } catch {
      return [];
    }
  }

  async getSorteoConditions(sorteoId: number): Promise<SorteoCondition[]> {
    try {
      const rows = await this.prisma.condicionSorteo.findMany({
        where: { idSorteo: sorteoId },
      });
      return rows.map((r) => ({
        TipoEvaluacion: r.tipoEvaluacion || '',
        ValorRequerido: r.valorRequerido || '',
        ValorTexto: r.valorTexto || '',
        ValorMonto: Number(r.valorMonto) || 0,
        ValorCantidad: Number(r.valorCantidad) || 0,
        Operador: r.operador || '',
      }));
    } catch {
      return [];
    }
  }

  async saveWonSorteo(
    posTransactionId: string,
    correlativo: string,
    sorteoId: number,
  ): Promise<void> {
    try {
      await this.prisma.ventaSorteo.create({
        data: {
          idTransaccionPos: posTransactionId,
          correlativo,
          idSorteo: sorteoId,
        },
      });
    } catch (e) {
      console.error('Error saving won Sorteo:', e);
    }
  }
}

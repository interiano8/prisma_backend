import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CampanasRepository,
  CampanaActiva,
  CampanaAdmin,
  CampanaWrite,
  CondicionWrite,
  CondicionCampanaRow,
  ItemCategoryRow,
  TicketVerificacion,
} from '../../../domain/ports/out/campanas-repository.interface';

@Injectable()
export class CampanasRepositoryImpl implements CampanasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveCampanas(tx?: any): Promise<CampanaActiva[]> {
    try {
      const now = new Date();
      const db = tx || this.prisma;
      const rows = await db.campana.findMany({
        where: {
          activo: true,
          fechaInicio: { lte: now },
          fechaFin: { gte: now },
        },
      });
      return rows.map((r) => ({
        CampanaID: r.id,
        Nombre: r.nombre || '',
        TextoTicket: r.textoTicket,
        ModoEvaluacion: r.modoEvaluacion,
        LimitePorCliente: r.limitePorCliente,
      }));
    } catch {
      return [];
    }
  }

  async getCampanaConditions(
    campanaId: number,
    tx?: any,
  ): Promise<CondicionCampanaRow[]> {
    try {
      const db = tx || this.prisma;
      const rows = await db.condicionCampana.findMany({
        where: { idCampana: campanaId },
      });
      return rows.map((r) => ({
        id: r.id,
        TipoEvaluacion: r.tipoEvaluacion,
        Operador: r.operador,
        ValorTexto: r.valorTexto || '',
        ValorMonto: Number(r.valorMonto) || 0,
        ValorCantidad: Number(r.valorCantidad) || 0,
      }));
    } catch {
      return [];
    }
  }

  async getItemCategories(codes: string[], tx?: any): Promise<ItemCategoryRow[]> {
    if (codes.length === 0) return [];
    try {
      const db = tx || this.prisma;
      const rows = await db.producto.findMany({
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

  async countParticipaciones(
    campanaId: number,
    codigoCliente: string,
    tx?: any,
  ): Promise<number> {
    try {
      const db = tx || this.prisma;
      return await db.participacionCampana.count({
        where: { idCampana: campanaId, codigoCliente },
      });
    } catch {
      return 0;
    }
  }

  async saveParticipacion(
    params: {
      posTransactionId: string;
      correlativo: string;
      campanaId: number;
      codigoCliente: string | null;
    },
    tx?: any,
  ): Promise<void> {
    try {
      const db = tx || this.prisma;
      await db.participacionCampana.create({
        data: {
          idTransaccionPos: params.posTransactionId,
          correlativo: params.correlativo,
          idCampana: params.campanaId,
          codigoCliente: params.codigoCliente,
        },
      });
    } catch (e) {
      console.error('Error saving participacion:', e);
    }
  }

  async getTicketByCorrelativo(
    correlativo: string,
  ): Promise<TicketVerificacion | null> {
    try {
      const row = await this.prisma.participacionCampana.findFirst({
        where: { correlativo },
        include: { campana: true },
      });
      if (!row) return null;
      return {
        correlativo: row.correlativo || '',
        campanaId: row.idCampana ?? 0,
        nombreCampana: row.campana?.nombre || '',
        idTransaccionPos: row.idTransaccionPos || '',
        codigoCliente: row.codigoCliente,
      };
    } catch {
      return null;
    }
  }

  async listCampanas(): Promise<CampanaAdmin[]> {
    try {
      const rows = await this.prisma.campana.findMany({
        include: {
          condiciones: true,
          _count: { select: { participaciones: true } },
        },
        orderBy: { id: 'asc' },
      });
      return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        fechaInicio: r.fechaInicio,
        fechaFin: r.fechaFin,
        activo: r.activo,
        textoTicket: r.textoTicket,
        modoEvaluacion: r.modoEvaluacion,
        limitePorCliente: r.limitePorCliente,
        condiciones: (r.condiciones || []).map((c) => ({
          id: c.id,
          TipoEvaluacion: c.tipoEvaluacion,
          Operador: c.operador,
          ValorTexto: c.valorTexto || '',
          ValorMonto: Number(c.valorMonto) || 0,
          ValorCantidad: Number(c.valorCantidad) || 0,
        })),
        participacionesCount: r._count.participaciones,
      }));
    } catch {
      return [];
    }
  }

  async createCampana(data: CampanaWrite): Promise<{ id: number }> {
    const row = await this.prisma.campana.create({ data });
    return { id: row.id };
  }

  async updateCampana(
    id: number,
    data: CampanaWrite,
  ): Promise<{ id: number }> {
    const row = await this.prisma.campana.update({ where: { id }, data });
    return { id: row.id };
  }

  async deleteCampana(id: number): Promise<void> {
    await this.prisma.campana.update({
      where: { id },
      data: { activo: false },
    });
  }

  async createCondicion(
    campanaId: number,
    data: CondicionWrite,
  ): Promise<{ id: number }> {
    const row = await this.prisma.condicionCampana.create({
      data: { ...data, idCampana: campanaId } as any,
    });
    return { id: row.id };
  }

  async updateCondicion(
    id: number,
    data: CondicionWrite,
  ): Promise<{ id: number }> {
    const row = await this.prisma.condicionCampana.update({
      where: { id },
      data: data as any,
    });
    return { id: row.id };
  }

  async deleteCondicion(id: number): Promise<void> {
    await this.prisma.condicionCampana.delete({ where: { id } });
  }
}
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DispenserRepository,
  PendingSaleRecord,
  SaleRecord,
  HoseFsMapping,
  ItemMetadata,
  SimpleHoseConfig,
  FuelSaleCreateInput,
  HosePumpId,
} from '../../../domain/ports/out/dispenser-repository.interface';
import { HoseConfig } from '../../../domain/entities/hose-config.entity';
import { PumpTransaction } from '../../../domain/entities/pump-transaction.entity';

@Injectable()
export class DispenserRepositoryImpl implements DispenserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPendingSales(): Promise<PendingSaleRecord[]> {
    try {
      const rows = await this.prisma.ventaCombustible.findMany({
        where: { facturada: false },
      });
      return rows.map((r) => ({
        SaleID: r.idVenta,
        PumpNumber: r.numeroBomba ?? 0,
        amount: Number(r.monto),
        ppu: Number(r.precioUnitario),
        volume: Number(r.volumen),
        GradeNr: r.numeroGrado,
        IsInvoiced: r.facturada === true,
      }));
    } catch {
      return [];
    }
  }

  async getSaleById(saleId: number): Promise<SaleRecord | null> {
    const r = await this.prisma.ventaCombustible.findUnique({
      where: { idVenta: saleId },
    });
    if (!r) return null;
    return {
      PumpNumber: r.numeroBomba ?? 0,
      HoseNumber: r.numeroManguera || '',
      amount: Number(r.monto),
      ppu: Number(r.precioUnitario),
      volume: Number(r.volumen),
      GradeNr: r.numeroGrado,
      IsInvoiced: r.facturada === true,
    };
  }

  async getHoseFsMapping(
    pumpId: number,
    hoseNumber: number,
  ): Promise<HoseFsMapping | null> {
    const r = await this.prisma.manguera.findFirst({
      where: { idBomba: pumpId, idMangueraFisica: hoseNumber },
    });
    if (!r) return null;
    return { CodigoPOS: r.codigoPos, TankIDs: r.idsTanques };
  }

  async getItemMetadata(itemCode: string): Promise<ItemMetadata | null> {
    const r = await this.prisma.producto.findUnique({
      where: { codigo: itemCode },
    });
    if (!r) return null;
    return {
      Description: r.descripcion,
      'VAT Prod_ Posting Group': r.grupoIsv,
      'Item Category Code': r.codigoCategoria,
      'Gen_ Pump Ledg_ Entry': r.generaAsientoBomba === true ? 1 : 0,
    };
  }

  async getHoseConfigs(): Promise<HoseConfig[]> {
    try {
      const rows = await this.prisma.manguera.findMany({
        where: { OR: [{ visible: true }, { visible: null }] },
      });
      return rows.map((r) => ({
        id: r.idManguera,
        hoseId: r.idManguera,
        gradeNumber: r.numeroGrado ?? 0,
        gradeName: r.nombreGrado || '',
        pricePerUnit: Number(r.precioUnitario) / 100000.0,
        pumpId: r.idBomba ?? 0,
        hosePhysicalId: r.idMangueraFisica ?? 0,
        codigoPos: r.codigoPos || '',
        esVisible: r.visible === true,
      }));
    } catch {
      return [];
    }
  }

  async getSimpleHoseConfigs(): Promise<SimpleHoseConfig[]> {
    try {
      const rows = await this.prisma.manguera.findMany({
        where: { OR: [{ visible: true }, { visible: null }] },
      });
      return rows.map((r) => ({
        pumpId: r.idBomba ?? 0,
        productName: r.nombreGrado,
        unitPrice: Number(r.precioUnitario) / 100000.0,
        pos: r.pos,
      }));
    } catch {
      return [];
    }
  }

  async getPumpTransactions(
    pumpId: number,
    limit?: number,
  ): Promise<PumpTransaction[]> {
    try {
      const rows = await this.prisma.ventaCombustible.findMany({
        where: { numeroBomba: pumpId },
        orderBy: { idVenta: 'desc' },
        ...(limit && limit > 0 ? { take: limit } : {}),
      });

      const mangueras = await this.prisma.manguera.findMany({
        select: {
          idBomba: true,
          numeroGrado: true,
          nombreGrado: true,
          unidadMedida: true,
          codigoGenerico: true,
          codigoPos: true,
        },
      });
      const gradeName = new Map<string, string>();
      const gradeUnit = new Map<string, string>();
      const gradeCode = new Map<string, string>();
      for (const m of mangueras) {
        if (m.numeroGrado == null) continue;
        const key = `${m.idBomba ?? ''}:${m.numeroGrado}`;
        if (m.nombreGrado) gradeName.set(key, m.nombreGrado);
        gradeUnit.set(key, m.unidadMedida || 'galones');
        gradeCode.set(key, m.codigoGenerico || m.codigoPos || '');
      }

      return rows.map((r) => {
        const gradeKey = `${r.numeroBomba ?? ''}:${r.numeroGrado ?? ''}`;
        return {
          saleId: r.idVenta,
          posNumber: r.numeroPos ?? 0,
          pumpNumber: r.numeroBomba ?? 0,
          hoseNumber: r.numeroManguera || '',
          grade: r.numeroGrado != null ? String(r.numeroGrado) : '',
          combustible: gradeName.get(gradeKey) || '',
          codigo: gradeCode.get(gradeKey) || '',
          unidad: gradeUnit.get(gradeKey) || 'galones',
          precio: Number(r.precioUnitario),
          cantidad: Number(r.volumen),
          estado: r.facturada ? 'Facturado' : 'Sin Facturar',
          amount: Number(r.monto),
          ciclo: '',
          date: r.fecha ? r.fecha.toISOString() : '',
          fecha: r.fechaTransaccion || '',
          hora: r.horaTransaccion || '',
          despachador: '',
        };
      });
    } catch {
      return [];
    }
  }

  async updateSaleInvoiced(saleId: string, posNumber: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        await this.prisma.ventaCombustible.update({
          where: { idVenta: parseInt(saleId, 10) },
          data: {
            facturada: true,
            numeroPos: parseInt(posNumber, 10) || undefined,
          },
        });
        return;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
      }
    }
  }

  async reverseFusionSale(saleId: string): Promise<void> {
    try {
      await this.prisma.ventaCombustible.update({
        where: { idVenta: parseInt(saleId, 10) },
        data: { facturada: false },
      });
    } catch (e) {
      console.warn('Error reversando venta de surtidor:', e);
    }
  }

  async renewTransactions(): Promise<number> {
    try {
      const result = await this.prisma.ventaCombustible.updateMany({
        where: { facturada: false },
        data: { fecha: new Date() },
      });
      return result.count;
    } catch (error) {
      console.error('Error al renovar transacciones:', error);
      throw error;
    }
  }

  async getHoseFsForPos(posNo: string): Promise<HosePumpId[]> {
    try {
      const rows = await this.prisma.manguera.findMany({
        where: { pos: posNo },
        distinct: ['idBomba'],
        select: { idBomba: true },
      });
      return rows.map((r) => ({ PumpID: r.idBomba }));
    } catch {
      return [];
    }
  }

  async countPendingSalesForPos(posNo: string): Promise<number> {
    try {
      const hosePumpIds = await this.prisma.manguera.findMany({
        where: { pos: posNo },
        distinct: ['idBomba'],
        select: { idBomba: true },
      });
      const pumpIds = hosePumpIds
        .map((h) => h.idBomba)
        .filter((p) => p != null);
      if (pumpIds.length === 0) return 0;
      return await this.prisma.ventaCombustible.count({
        where: { facturada: false, numeroBomba: { in: pumpIds } },
      });
    } catch {
      return 0;
    }
  }

  async getExistingSaleIds(): Promise<number[]> {
    const rows = await this.prisma.ventaCombustible.findMany({
      select: { idVenta: true },
    });
    return rows.map((r) => r.idVenta);
  }

  async createSales(data: FuelSaleCreateInput[]): Promise<number> {
    if (!data || data.length === 0) return 0;
    const BATCH = 1000;
    for (let i = 0; i < data.length; i += BATCH) {
      const chunk = data.slice(i, i + BATCH);
      await this.prisma.ventaCombustible.createMany({
        data: chunk as unknown as Prisma.VentaCombustibleCreateManyInput[],
        skipDuplicates: true,
      });
    }
    return data.length;
  }
}

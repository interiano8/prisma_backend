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
  private readonly wayneBaseUrl =
    process.env.WAYNE_API_URL ?? 'http://localhost:5008';

  constructor(private readonly prisma: PrismaService) {}

  private async wayneFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.wayneBaseUrl}${path}`, init);
  }

  async getPendingSales(): Promise<PendingSaleRecord[]> {
    try {
      const res = await this.wayneFetch('/api/sales/pending?limit=500');
      if (!res.ok) return [];
      const json = await res.json();
      const rows = json?.data ?? [];
      if (!Array.isArray(rows)) return [];
      return rows.map((r: any) => ({
        SaleID: r.saleId,
        PumpNumber: r.pumpId ?? 0,
        amount: Number(r.amount ?? 0),
        ppu: Number(r.ppu ?? 0),
        volume: Number(r.volume ?? 0),
        GradeNr: r.grade ?? 0,
        IsInvoiced: false,
      }));
    } catch {
      return [];
    }
  }

  async getSaleById(saleId: number): Promise<SaleRecord | null> {
    try {
      const res = await this.wayneFetch(`/api/sales/${saleId}`);
      if (!res.ok) return null;
      const json = await res.json();
      const r = json?.data;
      if (!r || r.saleId == null) return null;
      return {
        PumpNumber: r.pumpId ?? 0,
        HoseNumber: String(r.hoseId ?? ''),
        amount: Number(r.amount ?? 0),
        ppu: Number(r.ppu ?? 0),
        volume: Number(r.volume ?? 0),
        GradeNr: r.grade ?? 0,
        IsInvoiced: !!r.clearedAt,
      };
    } catch {
      return null;
    }
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
    try {
      await this.wayneFetch(`/api/sales/${saleId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'EFECTIVO' }),
      });
    } catch (err) {
      console.warn('[Dispenser] Error marcando venta como facturada en wayne:', err);
    }
  }

  async reverseFusionSale(saleId: string): Promise<void> {
    try {
      await this.wayneFetch(`/api/sales/${saleId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pumpNr: 0 }),
      });
    } catch (e) {
      console.warn('Error reversando venta de surtidor:', e);
    }
  }

  async renewTransactions(): Promise<number> {
    // El controlador (wayne) es dueño de las ventas; no hay renovación local.
    return 0;
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
      const pending = await this.getPendingSales();
      return pending.filter((p) => pumpIds.includes(p.PumpNumber)).length;
    } catch {
      return 0;
    }
  }

  async getExistingSaleIds(): Promise<number[]> {
    try {
      const pending = await this.getPendingSales();
      return pending.map((p) => p.SaleID);
    } catch {
      return [];
    }
  }

  async createSales(data: FuelSaleCreateInput[]): Promise<number> {
    // El controlador (wayne) persiste las ventas; esta operación ya no aplica.
    return 0;
  }
}

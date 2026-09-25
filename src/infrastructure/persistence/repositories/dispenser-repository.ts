import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DispenserRepository,
  PendingSaleRecord,
  PendingByShiftResult,
  SaleRecord,
  HoseFsMapping,
  ItemMetadata,
  SimpleHoseConfig,
  FuelSaleCreateInput,
  HosePumpId,
  RestartControladorResult,
} from '../../../domain/ports/out/dispenser-repository.interface';
import { HoseConfig } from '../../../domain/entities/hose-config.entity';
import { PumpTransaction } from '../../../domain/entities/pump-transaction.entity';
import { normalizeControllerUrl } from '../../../utils/controller-url';
import { InternalDomainError } from '../../../domain/errors/domain-error';

/** Venta devuelta por wayne (SaleDto de /api/sales/pump/{id}/sales). */
interface WayneSaleDto {
  saleId: number;
  pumpId: number;
  hoseId: number;
  grade: number | null;
  volume: number;
  amount: number;
  ppu: number;
  dateOfTransaction?: string;
  timeOfTransaction?: string;
  clearedAt?: string | null;
  isInvoiced?: boolean;
  shiftId?: number | null;
}

@Injectable()
export class DispenserRepositoryImpl implements DispenserRepository {
  private static readonly WAYNE_CACHE_TTL_MS = 60_000;

  private wayneBaseUrlCache: { url: string; at: number } | null = null;

  private wayneApiKeyCache: { key: string; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** API key del controlador (clave_controlador de la tienda), con cache corta. */
  private async getWayneApiKey(): Promise<string> {
    if (
      this.wayneApiKeyCache &&
      Date.now() - this.wayneApiKeyCache.at < DispenserRepositoryImpl.WAYNE_CACHE_TTL_MS
    ) {
      return this.wayneApiKeyCache.key;
    }

    let key = '';
    try {
      const store = await this.prisma.tienda.findFirst({
        where: { claveControlador: { not: null }, NOT: { claveControlador: '' } },
        orderBy: { idTienda: 'asc' },
        select: { claveControlador: true },
      });
      key = store?.claveControlador ?? '';
    } catch {
      // Fallback si la consulta falla.
    }
    if (!key) key = process.env.WAYNE_API_KEY ?? '';

    this.wayneApiKeyCache = { key, at: Date.now() };
    return key;
  }

  /**
   * URL base del controlador (wayne): se resuelve desde el campo
   * url_controlador de la tienda (IP + puerto). Con cache corta para no
   * consultar en cada request. Fallback a WAYNE_API_URL / localhost:5008.
   */
  private async getWayneBaseUrl(): Promise<string> {
    if (
      this.wayneBaseUrlCache &&
      Date.now() - this.wayneBaseUrlCache.at <
        DispenserRepositoryImpl.WAYNE_CACHE_TTL_MS
    ) {
      return this.wayneBaseUrlCache.url;
    }

    let raw = '';
    try {
      const store = await this.prisma.tienda.findFirst({
        where: { urlControlador: { not: null }, NOT: { urlControlador: '' } },
        orderBy: { idTienda: 'asc' },
        select: { urlControlador: true },
      });
      raw = store?.urlControlador ?? '';
    } catch {
      // Fallback si la consulta falla.
    }
    if (!raw) raw = process.env.WAYNE_API_URL ?? 'http://localhost:5008';

    const url = normalizeControllerUrl(raw);
    this.wayneBaseUrlCache = { url, at: Date.now() };
    return url;
  }

  private async wayneFetch(path: string, init?: RequestInit): Promise<Response> {
    const base = await this.getWayneBaseUrl();
    const key = await this.getWayneApiKey();
    const headers = new Headers(init?.headers);
    if (key) headers.set('X-API-Key', key);
    return fetch(`${base}${path}`, { ...init, headers });
  }

  async getPendingSales(includeLocked = false): Promise<PendingSaleRecord[]> {
    try {
      const res = await this.wayneFetch(
        `/api/sales/pending?limit=500&includeLocked=${includeLocked}`,
      );
      if (!res.ok) return [];
      const json = await res.json();
      const rows = json?.data ?? [];
      if (!Array.isArray(rows)) return [];
      return rows.map((r: any) => ({
        SaleID: r.saleId,
        PumpNumber: r.pumpId ?? 0,
        HoseId: r.hoseId ?? null,
        amount: Number(r.amount ?? 0),
        ppu: Number(r.ppu ?? 0),
        volume: Number(r.volume ?? 0),
        GradeNr: r.grade ?? 0,
        IsInvoiced: false,
        ShiftId: r.shiftId ?? null,
      }));
    } catch {
      return [];
    }
  }

  async getPendingSalesByUserShifts(
    saleIds: number[],
  ): Promise<PendingByShiftResult> {
    try {
      const res = await this.wayneFetch('/api/sales/pending-by-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds }),
      });
      if (!res.ok) return { shifts: [], pendientes: [] };
      const json = await res.json();
      const data = json?.data;
      if (!data) return { shifts: [], pendientes: [] };
      return {
        shifts: Array.isArray(data.shifts) ? data.shifts : [],
        pendientes: Array.isArray(data.pendientes)
          ? data.pendientes.map((p: any) => ({
              saleId: Number(p.saleId ?? 0),
              pumpId: Number(p.pumpId ?? 0),
              hoseId: Number(p.hoseId ?? 0),
              shiftId: Number(p.shiftId ?? 0),
              amount: Number(p.amount ?? 0),
              volume: Number(p.volume ?? 0),
            }))
          : [],
      };
    } catch {
      return { shifts: [], pendientes: [] };
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
        IsInvoiced: !!r.isInvoiced,
        ShiftId: r.shiftId ?? null,
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
    return {
      CodigoPOS: r.codigoPos,
      TankIDs: r.idsTanques,
      unidadMedida: r.unidadMedida ?? null,
    };
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
      UnidadMedida: r.codigoUmEtiquetas ?? null,
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
      // Cuántas transacciones devolver por bomba (env, default 400).
      const envLimit = Number(process.env.PUMP_TRANSACTIONS_LIMIT ?? '400');
      const effectiveLimit =
        limit && limit > 0 ? limit : Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 400;

      const res = await this.wayneFetch(
        `/api/sales/pump/${pumpId}/sales?limit=${effectiveLimit}`,
      );
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: WayneSaleDto[] };
      const rows = Array.isArray(json?.data) ? json.data : [];

      const mangueras = await this.prisma.manguera.findMany({
        select: {
          idBomba: true,
          numeroGrado: true,
          nombreGrado: true,
          unidadMedida: true,
          codigoGenerico: true,
          codigoPos: true,
          pos: true,
        },
      });
      const gradeName = new Map<string, string>();
      const gradeUnit = new Map<string, string>();
      const gradeCode = new Map<string, string>();
      const gradePos = new Map<string, string>();
      for (const m of mangueras) {
        if (m.numeroGrado == null) continue;
        const key = `${m.idBomba ?? ''}:${m.numeroGrado}`;
        if (m.nombreGrado) gradeName.set(key, m.nombreGrado);
        gradeUnit.set(key, m.unidadMedida || 'galones');
        gradeCode.set(key, m.codigoGenerico || m.codigoPos || '');
        if (m.pos) gradePos.set(key, m.pos);
      }

      return rows.map((r) => {
        const gradeKey = `${r.pumpId ?? ''}:${r.grade ?? ''}`;
        return {
          saleId: r.saleId,
          posNumber: Number(gradePos.get(gradeKey) ?? 0),
          pumpNumber: r.pumpId ?? 0,
          hoseNumber: String(r.hoseId ?? ''),
          grade: r.grade != null ? String(r.grade) : '',
          combustible: gradeName.get(gradeKey) || '',
          codigo: gradeCode.get(gradeKey) || '',
          unidad: gradeUnit.get(gradeKey) || 'galones',
          precio: Number(r.ppu ?? 0),
          cantidad: Number(r.volume ?? 0),
          estado: r.isInvoiced ? 'Facturado' : 'Sin Facturar',
          amount: Number(r.amount ?? 0),
          ciclo: '',
          date: r.dateOfTransaction ? `${r.dateOfTransaction} ${r.timeOfTransaction ?? ''}`.trim() : '',
          fecha: r.dateOfTransaction || '',
          hora: r.timeOfTransaction || '',
          despachador: '',
          shiftId: r.shiftId ?? null,
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
      return (await this.getPendingSalesForPos(posNo)).length;
    } catch {
      return 0;
    }
  }

  /**
   * Pendientes (incluyendo lockeadas) de las bombas del POS. Las caras se
   * resuelven desde `configuracion_pos.caras` (pump ids); si el JSON está
   * vacío/ausente, fallback a `manguera.pos`.
   */
  async getPendingSalesForPos(posNo: string): Promise<PendingSaleRecord[]> {
    try {
      const pending = await this.getPendingSales(true);

      const posConfig = await this.prisma.configuracionPos.findFirst({
        where: { codigoPos: posNo },
        select: { caras: true },
      });
      let pumpIds: number[] = [];
      if (Array.isArray(posConfig?.caras)) {
        pumpIds = (posConfig.caras as unknown[])
          .map((c) => Number(c))
          .filter((n) => Number.isFinite(n));
      }
      if (pumpIds.length === 0) {
        const hosePumpIds = await this.prisma.manguera.findMany({
          where: { pos: posNo },
          distinct: ['idBomba'],
          select: { idBomba: true },
        });
        pumpIds = hosePumpIds
          .map((h) => h.idBomba)
          .filter((p): p is number => p != null);
      }
      if (pumpIds.length === 0) return [];

      return pending.filter((p) => pumpIds.includes(p.PumpNumber));
    } catch {
      return [];
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

  async restartControlador(): Promise<RestartControladorResult> {
    const res = await this.wayneFetch('/api/admin/restart?delaySeconds=2', {
      method: 'POST',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new InternalDomainError(
        `wayne no pudo reiniciarse (${res.status}): ${body?.error ?? 'respuesta inválida'}`,
      );
    }
    const json = (await res.json()) as {
      data?: { message?: string; restartAt?: string; cooldownSeconds?: number };
    };
    return {
      message: json?.data?.message ?? 'Reinicio solicitado',
      restartAt: json?.data?.restartAt ?? '',
      cooldownSeconds: json?.data?.cooldownSeconds ?? 0,
    };
  }
}

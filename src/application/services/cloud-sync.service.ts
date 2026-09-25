import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CloudSyncStatus {
  status: 'online' | 'offline' | 'syncing' | 'not_configured';
  pendingCount: number;
  lastSyncAt: string | null;
  latencyMs?: number | null;
  error?: string | null;
  masterVersion?: number;
}

@Injectable()
export class CloudSyncService {
  private readonly logger = new Logger(CloudSyncService.name);

  private status: 'online' | 'offline' | 'syncing' | 'not_configured' = 'online';
  private pendingCount = 0;
  private lastSyncAt: string | null = null;
  private latencyMs: number | null = null;
  private error: string | null = null;
  private masterVersion = 0;
  private lastSyncedTimestamp: Date = new Date(0);

  constructor(private readonly prisma: PrismaService) {}

  getSyncStatus(): CloudSyncStatus {
    const syncUrl = process.env.BACKOFFICE_SYNC_URL;
    if (!syncUrl || syncUrl.trim() === '') {
      return {
        status: 'not_configured',
        pendingCount: 0,
        lastSyncAt: null,
      };
    }

    return {
      status: this.status,
      pendingCount: this.pendingCount,
      lastSyncAt: this.lastSyncAt,
      latencyMs: this.latencyMs,
      error: this.error,
      masterVersion: this.masterVersion,
    };
  }

  async syncPendingSales(): Promise<{ success: boolean; syncedCount: number }> {
    const syncUrl = process.env.BACKOFFICE_SYNC_URL;
    if (!syncUrl || syncUrl.trim() === '') {
      this.status = 'not_configured';
      return { success: true, syncedCount: 0 };
    }

    const storeCode = process.env.STORE_CODE || '001';
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';
    const start = Date.now();

    try {
      // 1. Consultar ventas pendientes generadas después del último cursor
      const pendingSales = await this.prisma.venta.findMany({
        where: {
          fechaHoraVenta: {
            gt: this.lastSyncedTimestamp,
          },
        },
        include: {
          lineasVenta: true,
          pagosVenta: true,
        },
        orderBy: {
          fechaHoraVenta: 'asc',
        },
        take: 50,
      });

      this.pendingCount = pendingSales.length;

      if (pendingSales.length === 0) {
        this.status = 'online';
        this.latencyMs = Date.now() - start;
        return { success: true, syncedCount: 0 };
      }

      this.status = 'syncing';

      // 2. Mapear lote al formato de Backoffice
      const payload = {
        storeCode,
        storeName: process.env.STORE_NAME || `Estación ${storeCode}`,
        sentAt: new Date().toISOString(),
        sales: pendingSales.map((v) => ({
          transactionId: v.idTransaccionPos,
          docType: v.tipoDocumento || 1,
          docNo: v.numeroDocumento || '',
          appliedDocNo: v.documentoRelacionado || undefined,
          shiftDate: v.fechaHoraVenta
            ? v.fechaHoraVenta.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          shiftNo: v.numeroTurno || '1',
          employeeName: v.codigoVendedor || 'Cajero',
          customerNo: v.codigoCliente || undefined,
          customerName: v.nombreCliente || undefined,
          rtn: v.rtnCliente || undefined,
          subTotal: Number(v.subtotal) || 0,
          totalAmount: Number(v.monto) || 0,
          km: v.kilometraje || undefined,
          orden: v.orden || undefined,
          placa: v.placa || undefined,
          chofer: v.chofer || undefined,
          reconcilerShiftId: v.idTransaccionPos,
          lines: (v.lineasVenta || []).map((l) => ({
            lineNo: l.numeroLineaDocumento,
            externalId: `${v.idTransaccionPos}-${l.numeroLineaDocumento}`,
            timestamp: v.fechaHoraVenta
              ? v.fechaHoraVenta.toISOString()
              : new Date().toISOString(),
            amount: Number(l.montoConIsv) || 0,
            unitPrice: Number(l.precioUnitarioConIsv) || 0,
            volume: Number(l.cantidad) || 0,
            productName: l.codigoProducto || 'Combustible',
            pumpId: l.posicionBomba ? String(l.posicionBomba) : undefined,
            tankId: l.numeroTanque ? String(l.numeroTanque) : undefined,
            discount: Number(l.montoDescuentoLinea) || 0,
          })),
          payments: (v.pagosVenta || []).map((p) => ({
            chargeLineNo: p.numeroLineaPago,
            chargeMethodCode: p.codigoMetodoPago || 'EFECTIVO',
            description: p.descripcion || 'Efectivo',
            amount: Number(p.monto) || 0,
            esTicket: p.esTicket || false,
          })),
        })),
        queueCount: pendingSales.length,
      };

      // 3. Enviar lote por HTTPS a Cloudflare Tunnel
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(`${syncUrl.replace(/\/+$/, '')}/up`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-sync-key': syncKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const resData = (await res.json()) as any;
        const lastItem = pendingSales[pendingSales.length - 1];
        if (lastItem.fechaHoraVenta) {
          this.lastSyncedTimestamp = lastItem.fechaHoraVenta;
        }

        this.lastSyncAt = new Date().toISOString();
        this.status = 'online';
        this.latencyMs = Date.now() - start;
        this.pendingCount = 0;
        this.error = null;

        return {
          success: true,
          syncedCount: resData.processedSales || pendingSales.length,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      this.status = 'offline';
      this.error = err.message || 'Error de conexión con Backoffice Cloud';
      this.logger.warn(`Sincronización con Backoffice en cola: ${this.error}`);
      return { success: false, syncedCount: 0 };
    }
  }

  async pullMasters(): Promise<{ success: boolean; updated: boolean }> {
    const syncUrl = process.env.BACKOFFICE_SYNC_URL;
    if (!syncUrl || syncUrl.trim() === '') {
      return { success: true, updated: false };
    }

    const storeCode = process.env.STORE_CODE || '001';
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    try {
      const url = `${syncUrl.replace(/\/+$/, '')}/down/masters?storeCode=${encodeURIComponent(storeCode)}&sinceVersion=${this.masterVersion}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(url, {
          headers: { 'x-sync-key': syncKey },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = (await res.json()) as any;
        if (data.hasUpdates) {
          this.masterVersion = data.masterVersion;
          // Aplicar precios si vienen en el payload
          for (const price of data.fuelPrices || []) {
            await this.prisma.precioProducto.updateMany({
              where: { idManguera: price.gradeId },
              data: { precioUnitarioConIsv: price.unitPrice },
            }).catch(() => {});
          }
          return { success: true, updated: true };
        }

        return { success: true, updated: false };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      this.logger.debug(`No se pudo verificar maestros de nube: ${err.message}`);
      return { success: false, updated: false };
    }
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreBootstrapService } from './store-bootstrap.service';

export interface CloudSyncStatus {
  status: 'online' | 'offline' | 'syncing' | 'not_configured';
  pendingCount: number;
  lastSyncAt: string | null;
  latencyMs?: number | null;
  error?: string | null;
  masterVersion?: number;
}

@Injectable()
export class CloudSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudSyncService.name);

  private status: 'online' | 'offline' | 'syncing' | 'not_configured' = 'online';
  private pendingCount = 0;
  private lastSyncAt: string | null = null;
  private latencyMs: number | null = null;
  private error: string | null = null;
  private masterVersion = 0;
  private lastSyncedTimestamp: Date = new Date(0);
  private lastSyncedShiftTimestamp: Date = new Date(0);
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private isPinging = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storeBootstrapService?: StoreBootstrapService,
  ) {}

  getBaseSyncUrl(): string {
    const raw = (process.env.BACKOFFICE_SYNC_URL || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    return raw.endsWith('/sync') ? raw : `${raw}/sync`;
  }

  getSyncStatus(): CloudSyncStatus {
    const syncUrl = this.getBaseSyncUrl();
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

  async getClosedShiftsForSync(): Promise<any[]> {
    if (!this.prisma.turno?.findMany) {
      return [];
    }

    try {
      const shifts = await this.prisma.turno.findMany({
        where: {
          finTurno: {
            not: null,
            gt: this.lastSyncedShiftTimestamp,
          },
        },
        orderBy: { finTurno: 'asc' },
        take: 10,
      });

      const result: any[] = [];
      for (const s of shifts) {
        const dayStart = new Date(s.inicioTurno);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const turnoNum = s.turno?.toString() || '1';

        const txs = this.prisma.registroTransaccion?.findMany
          ? await this.prisma.registroTransaccion.findMany({
              where: {
                numeroTurno: turnoNum,
                fechaTurno: { gte: dayStart, lte: dayEnd },
                tipoTransaccion: { in: [1, 2, 3] },
              },
              select: { idTransaccionPos: true },
              orderBy: { fechaHoraTransaccion: 'asc' },
            })
          : [];

        const txIds = txs.map((t: any) => t.idTransaccionPos);
        const sales =
          txIds.length > 0 && this.prisma.venta?.findMany
            ? await this.prisma.venta.findMany({
                where: { idTransaccionPos: { in: txIds } },
                select: { monto: true, subtotal: true },
              })
            : [];

        const totalSalesCount = sales.length;
        const totalSalesAmount =
          Math.round(
            sales.reduce((sum: number, v: any) => sum + (Number(v.monto) || 0), 0) * 100,
          ) / 100;
        const totalDiscount =
          Math.round(
            sales.reduce(
              (sum: number, v: any) =>
                sum + (v.subtotal ? Math.max(0, Number(v.subtotal) - Number(v.monto)) : 0),
              0,
            ) * 100,
          ) / 100;

        let cashDeclared = Number(s.importeContado) || 0;
        let cardDeclared = 0;
        let otherDeclared = 0;

        if (s.detallePagos && typeof s.detallePagos === 'object') {
          const dp = s.detallePagos as Record<string, number>;
          for (const [key, val] of Object.entries(dp)) {
            const k = key.toUpperCase();
            const amount = Number(val) || 0;
            if (k.includes('EFECT') || k === '1002') {
              cashDeclared = amount;
            } else if (k.includes('TARJ') || k === '1003' || k === '1004') {
              cardDeclared += amount;
            } else {
              otherDeclared += amount;
            }
          }
        }

        result.push({
          shiftDate: s.inicioTurno.toISOString().split('T')[0],
          shiftNo: turnoNum,
          employeeName: s.nombreEmpleado || 'Cajero',
          startTime: s.inicioTurno.toISOString(),
          endTime: s.finTurno ? s.finTurno.toISOString() : undefined,
          status: 'CLOSED',
          totalSale: totalSalesAmount,
          totalDiscount,
          cashDeclared,
          cardDeclared,
          otherDeclared,
          controlTotals: {
            totalSalesCount,
            totalSalesAmount,
            firstTransactionId: txIds.length > 0 ? txIds[0] : undefined,
            lastTransactionId:
              txIds.length > 0 ? txIds[txIds.length - 1] : undefined,
          },
        });
      }

      return result;
    } catch (err: any) {
      this.logger.warn(`Error al consultar turnos cerrados para sync: ${err.message}`);
      return [];
    }
  }

  async syncPendingSales(): Promise<{ success: boolean; syncedCount: number }> {
    const syncUrl = this.getBaseSyncUrl();
    if (!syncUrl || syncUrl.trim() === '') {
      this.status = 'not_configured';
      return { success: true, syncedCount: 0 };
    }

    if (this.isSyncing) {
      return { success: true, syncedCount: 0 };
    }
    this.isSyncing = true;

    const storeCode = process.env.STORE_CODE || '001';
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';
    const start = Date.now();

    try {
      // 1. Consultar ventas y turnos pendientes
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

      const closedShifts = await this.getClosedShiftsForSync();

      this.pendingCount = pendingSales.length;

      if (pendingSales.length === 0 && closedShifts.length === 0) {
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
            productName: l.descripcion || 'Combustible',
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
        shifts: closedShifts.length > 0 ? closedShifts : undefined,
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
        if (pendingSales.length > 0) {
          const lastItem = pendingSales[pendingSales.length - 1];
          if (lastItem.fechaHoraVenta) {
            this.lastSyncedTimestamp = lastItem.fechaHoraVenta;
          }
        }
        if (closedShifts.length > 0) {
          const lastShift = closedShifts[closedShifts.length - 1];
          if (lastShift.endTime) {
            this.lastSyncedShiftTimestamp = new Date(lastShift.endTime);
          }
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
    } finally {
      this.isSyncing = false;
    }
  }

  async pullMasters(): Promise<{ success: boolean; updated: boolean }> {
    const syncUrl = this.getBaseSyncUrl();
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
          // Sincronizar actualización de configuración y mangueras de tienda
          if (this.storeBootstrapService) {
            await this.storeBootstrapService.bootstrapStoreConfig().catch((err) => {
              this.logger.debug(`Error en actualización de config de tienda: ${err.message}`);
            });
          }
          // Aplicar precios si vienen en el payload
          for (const price of data.fuelPrices || []) {
            if (this.prisma.precioProducto?.updateMany) {
              await (this.prisma.precioProducto.updateMany as any)({
                where: { idManguera: price.gradeId },
                data: { precioUnitarioConIsv: price.unitPrice },
              }).catch(() => {});
            }
          }

          // Aplicar reglas de descuento sincronizadas desde Store 000
          for (const rule of data.discountRules || []) {
            await this.prisma.reglaDescuento.upsert({
              where: { id: rule.id },
              update: {
                codigoCliente: rule.codigoCliente || null,
                codigoProducto: rule.codigoProducto || null,
                codigoCategoria: rule.codigoCategoria || null,
                cantidadMinima: rule.cantidadMinima ?? null,
                tipoBeneficio: rule.tipoBeneficio,
                valor: rule.valor,
                unidadVolumen: rule.unidadVolumen || null,
                prioridad: rule.prioridad ?? 0,
                fechaInicio: rule.fechaInicio ? new Date(rule.fechaInicio) : null,
                fechaFin: rule.fechaFin ? new Date(rule.fechaFin) : null,
                activo: rule.activo ?? true,
                acumulable: rule.acumulable ?? false,
                idTienda: rule.idTienda || null,
              },
              create: {
                id: rule.id,
                codigoCliente: rule.codigoCliente || null,
                codigoProducto: rule.codigoProducto || null,
                codigoCategoria: rule.codigoCategoria || null,
                cantidadMinima: rule.cantidadMinima ?? null,
                tipoBeneficio: rule.tipoBeneficio,
                valor: rule.valor,
                unidadVolumen: rule.unidadVolumen || null,
                prioridad: rule.prioridad ?? 0,
                fechaInicio: rule.fechaInicio ? new Date(rule.fechaInicio) : null,
                fechaFin: rule.fechaFin ? new Date(rule.fechaFin) : null,
                activo: rule.activo ?? true,
                acumulable: rule.acumulable ?? false,
                idTienda: rule.idTienda || null,
              },
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

  async sendHeartbeatPing(): Promise<{
    success: boolean;
    latencyMs?: number;
    serverTime?: string;
    error?: string;
  }> {
    const syncUrl = this.getBaseSyncUrl();
    if (!syncUrl || syncUrl.trim() === '') {
      this.status = 'not_configured';
      return { success: false, error: 'BACKOFFICE_SYNC_URL not configured' };
    }

    const storeCode = process.env.STORE_CODE || '001';
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';
    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${syncUrl.replace(/\/+$/, '')}/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-key': syncKey,
        },
        body: JSON.stringify({
          storeCode,
          queueCount: this.pendingCount,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as any;
      const latency = Date.now() - start;
      const wasOffline = this.status === 'offline';

      this.latencyMs = latency;
      this.status = 'online';
      this.error = null;

      // Reintento automático no bloqueante de la cola local si nos acabamos de reconectar o hay ventas acumuladas
      if (wasOffline || this.pendingCount > 0) {
        this.logger.log('Conectividad con Hub detectada activa. Disparando sincronización no bloqueante de cola...');
        this.triggerNonBlockingSync();
      }

      return {
        success: true,
        latencyMs: latency,
        serverTime: data.serverTime,
      };
    } catch (err: any) {
      this.status = 'offline';
      this.error = err.message || 'Error al enviar latido a Backoffice Cloud';
      this.logger.debug(`Latido de monitoreo fallido: ${this.error}`);
      return { success: false, error: this.error || undefined };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  triggerNonBlockingSync(): void {
    if (this.isSyncing) return;
    this.syncPendingSales().catch((err) => {
      this.logger.warn(`Error en sincronización en segundo plano: ${err.message}`);
    });
  }

  startHeartbeatLoop(intervalMs?: number): void {
    this.stopHeartbeatLoop();
    const interval =
      intervalMs ??
      (process.env.SYNC_HEARTBEAT_INTERVAL_MS
        ? Number(process.env.SYNC_HEARTBEAT_INTERVAL_MS)
        : 30000);

    this.heartbeatTimer = setInterval(async () => {
      if (this.isPinging) return;
      this.isPinging = true;
      try {
        await this.sendHeartbeatPing();
      } finally {
        this.isPinging = false;
      }
    }, interval);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  stopHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  onModuleInit(): void {
    const syncUrl = process.env.BACKOFFICE_SYNC_URL;
    if (syncUrl && syncUrl.trim() !== '' && process.env.NODE_ENV !== 'test') {
      if (this.storeBootstrapService) {
        this.storeBootstrapService.bootstrapStoreConfig().catch((err) => {
          this.logger.warn(`Error en bootstrap inicial de tienda: ${err.message}`);
        });
      }
      this.startHeartbeatLoop();
    }
  }

  onModuleDestroy(): void {
    this.stopHeartbeatLoop();
  }
}

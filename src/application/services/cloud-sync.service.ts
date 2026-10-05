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

  async pullMasters(force = false): Promise<{ success: boolean; updated: boolean }> {
    const syncUrl = this.getBaseSyncUrl();
    if (!syncUrl || syncUrl.trim() === '') {
      return { success: true, updated: false };
    }

    const storeCode = process.env.STORE_CODE || '001';
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    try {
      // Sincronizar siempre la configuración de tienda y mangueras pasando la bandera 'force'
      if (this.storeBootstrapService) {
        await this.storeBootstrapService.bootstrapStoreConfig(force).catch((err) => {
          this.logger.debug(`Error en actualización de config de tienda: ${err.message}`);
        });
      }

      const versionParam = force ? 0 : this.masterVersion;
      const url = `${syncUrl.replace(/\/+$/, '')}/down/masters?storeCode=${encodeURIComponent(storeCode)}&sinceVersion=${versionParam}`;
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

          // Ingestar y sincronizar usuarios y empleados en la base local prisma
          if (Array.isArray(data.users)) {
            const matrixUsernames: string[] = [];
            for (const user of data.users) {
              try {
                if (!user.username || typeof user.username !== 'string') continue;
                const cleanUsername = user.username.trim();
                matrixUsernames.push(cleanUsername);
                const updateData: any = {
                  nombre: user.name || cleanUsername,
                  hashContrasena: user.passwordHash || null,
                  perfil: user.role || 'Admin',
                  estaActivo: user.active !== false,
                };
                if (user.pin !== undefined) {
                  updateData.pin = user.pin;
                }
                if (user.rfid !== undefined) {
                  updateData.codigoRfid = user.rfid;
                }

                if (this.prisma.empleado?.upsert) {
                  await this.prisma.empleado.upsert({
                    where: { usuario: cleanUsername },
                    update: updateData,
                    create: {
                      usuario: cleanUsername,
                      nombre: updateData.nombre,
                      hashContrasena: updateData.hashContrasena,
                      perfil: updateData.perfil,
                      estaActivo: updateData.estaActivo,
                      pin: updateData.pin ?? null,
                      codigoRfid: updateData.codigoRfid ?? null,
                    },
                  });
                } else if (this.prisma.empleado?.findFirst) {
                  const existing = await this.prisma.empleado.findFirst({
                    where: { usuario: { equals: cleanUsername, mode: 'insensitive' } },
                    select: { id: true },
                  });
                  if (existing) {
                    await this.prisma.empleado.update({
                      where: { id: existing.id },
                      data: updateData,
                    });
                  } else {
                    await this.prisma.empleado.create({
                      data: {
                        usuario: cleanUsername,
                        nombre: updateData.nombre,
                        hashContrasena: updateData.hashContrasena,
                        perfil: updateData.perfil,
                        estaActivo: updateData.estaActivo,
                        pin: updateData.pin ?? null,
                        codigoRfid: updateData.codigoRfid ?? null,
                      },
                    });
                  }
                }
              } catch (userErr: any) {
                this.logger.warn(`No se pudo sincronizar usuario ${user?.username}: ${userErr.message}`);
              }
            }

            // INTEGRIDAD: desactivar empleados locales que ya no existen en la
            // matriz (fuente única de verdad de usuarios). Así no quedan cuentas
            // activas que solo viven en la BD del POS.
            if (matrixUsernames.length > 0) {
              const lower = new Set(matrixUsernames.map((u) => u.toLowerCase()));
              try {
                if (this.prisma.empleado?.findMany && this.prisma.empleado?.updateMany) {
                  const local = await this.prisma.empleado.findMany({
                    select: { id: true, usuario: true },
                  });
                  const toDisable = local
                    .filter((e: any) => !lower.has(String(e.usuario || '').toLowerCase()))
                    .map((e: any) => e.id);
                  if (toDisable.length > 0) {
                    await (this.prisma.empleado.updateMany as any)({
                      where: { id: { in: toDisable }, estaActivo: true },
                      data: { estaActivo: false },
                    });
                    this.logger.warn(
                      `[SYNC MASTERS] Empleados desactivados por no existir en la matriz: ${toDisable.length}`,
                    );
                  }
                }
              } catch (deactErr: any) {
                this.logger.warn(`No se pudo desactivar huérfanos: ${deactErr.message}`);
              }
            }
          }

          // Ingestar y sincronizar clientes desde el catálogo central (casa matriz).
          if (Array.isArray(data.customers)) {
            const matrixCustomerCodes: string[] = [];
            for (const cust of data.customers) {
              try {
                if (!cust.customerNo || typeof cust.customerNo !== 'string') continue;
                const cleanCode = cust.customerNo.trim();
                matrixCustomerCodes.push(cleanCode);
                const updateData: any = {
                  nombre: cust.customerName || cleanCode,
                  tipoFacturacion: Number(cust.billingType) === 0 ? 0 : 1,
                  bloqueado: cust.blocked === true || cust.blocked === 1,
                  fechaActualizacion: new Date(),
                };
                if (cust.rtn !== undefined) updateData.rtn = String(cust.rtn || '');
                if (cust.phone !== undefined) updateData.telefono = String(cust.phone || '');
                if (cust.email !== undefined) updateData.correo = String(cust.email || '');
                if (cust.address !== undefined) updateData.direccion = String(cust.address || '');
                if (cust.balance !== undefined && cust.balance != null) {
                  updateData.saldo = Number(cust.balance) || 0;
                }

                if (this.prisma.cliente?.upsert) {
                  await this.prisma.cliente.upsert({
                    where: { codigo: cleanCode },
                    update: updateData,
                    create: {
                      codigo: cleanCode,
                      nombre: updateData.nombre,
                      rtn: updateData.rtn ?? '',
                      telefono: updateData.telefono ?? '',
                      correo: updateData.correo ?? '',
                      direccion: updateData.direccion ?? '',
                      tipoFacturacion: updateData.tipoFacturacion,
                      bloqueado: updateData.bloqueado,
                      saldo: updateData.saldo ?? 0,
                      fechaActualizacion: updateData.fechaActualizacion,
                    },
                  });
                } else if (this.prisma.cliente?.findFirst) {
                  const existingC = await this.prisma.cliente.findFirst({
                    where: { codigo: { equals: cleanCode, mode: 'insensitive' } },
                    select: { codigo: true },
                  });
                  if (existingC) {
                    await this.prisma.cliente.update({
                      where: { codigo: existingC.codigo },
                      data: updateData,
                    });
                  } else {
                    await this.prisma.cliente.create({
                      data: {
                        codigo: cleanCode,
                        nombre: updateData.nombre,
                        rtn: updateData.rtn ?? '',
                        telefono: updateData.telefono ?? '',
                        correo: updateData.correo ?? '',
                        direccion: updateData.direccion ?? '',
                        tipoFacturacion: updateData.tipoFacturacion,
                        bloqueado: updateData.bloqueado,
                        saldo: updateData.saldo ?? 0,
                        fechaActualizacion: updateData.fechaActualizacion,
                      },
                    });
                  }
                }
              } catch (custErr: any) {
                this.logger.warn(
                  `No se pudo sincronizar cliente ${cust?.customerNo}: ${custErr.message}`,
                );
              }
            }

            // INTEGRIDAD DE CLIENTES
            if (matrixCustomerCodes.length > 0) {
              const centralCodes = new Set(matrixCustomerCodes);
              try {
                if (this.prisma.cliente?.findMany && this.prisma.cliente?.updateMany) {
                  const localCustomers = await this.prisma.cliente.findMany({
                    select: { codigo: true, tipoFacturacion: true, bloqueado: true },
                  });
                  const orphanCredits = localCustomers.filter(
                    (c: any) =>
                      Number(c.tipoFacturacion) === 0 &&
                      !centralCodes.has(String(c.codigo || '').trim()),
                  );
                  const toBlock = orphanCredits.map((c: any) => c.codigo);
                  if (toBlock.length > 0) {
                    await (this.prisma.cliente.updateMany as any)({
                      where: { codigo: { in: toBlock }, bloqueado: { not: true } },
                      data: { bloqueado: true, fechaActualizacion: new Date() },
                    });
                    this.logger.warn(
                      `[SYNC MASTERS] Clientes de crédito deshabilitados por no existir en la matriz: ${toBlock.length}`,
                    );
                  }
                }
              } catch (custDeactErr: any) {
                this.logger.warn(`No se pudo deshabilitar créditos huérfanos: ${custDeactErr.message}`);
              }
            }

            // SINCRONIZACIÓN DE MÉTODOS DE PAGO
            if (Array.isArray(data.paymentMethods) && data.paymentMethods.length > 0) {
              for (const pm of data.paymentMethods) {
                try {
                  if (!pm.code) continue;
                  const cleanCode = String(pm.code).trim();
                  const isMasterActive = pm.active === true;

                  if (this.prisma.metodoPago?.upsert) {
                    await this.prisma.metodoPago.upsert({
                      where: { codigo: cleanCode },
                      update: {
                        descripcion: pm.description || cleanCode,
                        categoria: (pm.category || 'EFECTIVO').trim().toUpperCase(),
                        moneda: (pm.currency || 'HNL').trim().toUpperCase(),
                        generaCambio: pm.generatesChange ?? false,
                        facturaContado: pm.invoiceCash ?? false,
                        facturaCredito: pm.invoiceCredit ?? false,
                        salidaCombustible: pm.fuelOutflow ?? false,
                        fidelizacion: pm.loyalty ?? false,
                        requiereReferencia: pm.requiresReference ?? false,
                        imagen: pm.image || null,
                        activo: isMasterActive,
                      },
                      create: {
                        codigo: cleanCode,
                        descripcion: pm.description || cleanCode,
                        categoria: (pm.category || 'EFECTIVO').trim().toUpperCase(),
                        moneda: (pm.currency || 'HNL').trim().toUpperCase(),
                        generaCambio: pm.generatesChange ?? false,
                        facturaContado: pm.invoiceCash ?? false,
                        facturaCredito: pm.invoiceCredit ?? false,
                        salidaCombustible: pm.fuelOutflow ?? false,
                        fidelizacion: pm.loyalty ?? false,
                        requiereReferencia: pm.requiresReference ?? false,
                        imagen: pm.image || null,
                        activo: isMasterActive,
                      },
                    });
                  }
                } catch (pmErr: any) {
                  this.logger.warn(`No se pudo sincronizar forma de pago ${pm?.code}: ${pmErr.message}`);
                }
              }
            }

            // SINCRONIZACIÓN DE TASAS DE CAMBIO
            if (Array.isArray(data.exchangeRates) && data.exchangeRates.length > 0) {
              for (const er of data.exchangeRates) {
                try {
                  if (!er.rate || !er.startDate) continue;
                  const dateObj = new Date(er.startDate);
                  if (isNaN(dateObj.getTime())) continue;

                  if (this.prisma.tasaCambio?.findFirst && this.prisma.tasaCambio?.create) {
                    const existing = await this.prisma.tasaCambio.findFirst({
                      where: { fecha: dateObj },
                    });
                    if (existing) {
                      await this.prisma.tasaCambio.update({
                        where: { id: existing.id },
                        data: { tasa: er.rate },
                      });
                    } else {
                      await this.prisma.tasaCambio.create({
                        data: { tasa: er.rate, fecha: dateObj },
                      });
                    }
                  }
                } catch (erErr: any) {
                  this.logger.warn(`No se pudo sincronizar tasa de cambio: ${erErr.message}`);
                }
              }
            }
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

  /**
   * Replica hacia la casa matriz (POST /sync/up/customers) los clientes de
   * CONTADO creados localmente en este POS. Solo se envían clientes cuyo código
   * tiene el prefijo local CCO-{storeCode}- (generados por este POS); los
   * clientes bajados desde la matriz (incluidos contados de otras tiendas y
   * créditos) no se re-suben. Best-effort: un fallo de red no rompe el ciclo.
   */
  async syncUpCustomers(): Promise<{ success: boolean; syncedCount: number }> {
    const syncUrl = this.getBaseSyncUrl();
    if (!syncUrl || syncUrl.trim() === '') {
      return { success: true, syncedCount: 0 };
    }
    const storeCode = process.env.STORE_CODE || '001';
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';
    const localPrefix = `CCO-${storeCode.trim().padStart(3, '0')}-`;

    try {
      if (!this.prisma.cliente?.findMany) {
        return { success: true, syncedCount: 0 };
      }
      // Clientes de contado creados por ESTE POS (prefijo local).
      const localCash = await this.prisma.cliente.findMany({
        where: {
          tipoFacturacion: 1,
          codigo: { startsWith: localPrefix },
        },
        select: {
          codigo: true,
          nombre: true,
          rtn: true,
          telefono: true,
          correo: true,
          direccion: true,
        },
        take: 100,
      });
      if (localCash.length === 0) {
        return { success: true, syncedCount: 0 };
      }

      const payload = {
        storeCode,
        customers: localCash.map((c: any) => ({
          customerNo: c.codigo,
          customerName: c.nombre || c.codigo,
          rtn: c.rtn || null,
          phone: c.telefono || null,
          email: c.correo || null,
          address: c.direccion || null,
          billingType: 1,
          blocked: false,
        })),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`${syncUrl.replace(/\/+$/, '')}/up/customers`, {
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
        const data = (await res.json()) as { inserted?: number; accepted?: number };
        this.logger.log(
          `[SYNC UP] Clientes de contado locales enviados a la matriz: ${localCash.length} (nuevos en 000: ${data.inserted ?? 0})`,
        );
        return { success: true, syncedCount: localCash.length };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      this.logger.warn(`No se pudieron replicar clientes de contado: ${err.message}`);
      return { success: false, syncedCount: 0 };
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

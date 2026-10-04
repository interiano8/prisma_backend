import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BootstrapResult {
  applied: boolean;
  storeCode?: string;
  configVersion?: number;
  reason?: 'NOT_CONFIGURED' | 'UP_TO_DATE' | 'OFFLINE' | 'INVALID_RESPONSE' | 'APPLIED';
  hosesCount?: number;
  error?: string;
}

export interface RemoteProvisioningPayload {
  storeCode: string;
  configVersion: number;
  tienda: {
    nombre?: string | null;
    rtn?: string | null;
    emisor?: string | null;
    titulo?: string | null;
    direccion1?: string | null;
    telefono?: string | null;
    correo?: string | null;
    ipFusion?: string | null;
    urlControlador?: string | null;
    claveControlador?: string | null;
    esControladorGas?: boolean;
    moneda?: string | null;
    codigoMoneda?: string | null;
    logoUrl?: string | null;
    variasLineasPermitidas?: boolean;
    descuentosPermitidos?: boolean;
    casaMatriz?: string | null;
    noConsumidorFinal?: string | null;
  };
  configuracionPos: {
    codigoPos?: string;
    pantallaEnBomba?: boolean;
    bloquearSoloPos?: boolean;
    mostrarVideoPublicidad?: boolean;
    reimprimirVarios?: boolean;
    facturarVariasLineas?: boolean;
    descuentoManual?: boolean;
    ocultarBotonOtrasBombas?: boolean;
    ocultarInformacionTurnos?: boolean;
    mostrarBombas?: boolean;
    numTransaccionesBombas?: number;
    minutosAtrasada?: number;
    mostrarTeclado?: boolean;
    declararMontosIniciales?: boolean;
    config?: any;
  };
  mangueras: Array<{
    idManguera: number;
    idBomba?: number;
    idMangueraFisica?: number;
    numeroGrado?: number;
    nombreGrado?: string;
    precioUnitario?: number;
    idsTanques?: string | null;
    pos?: string;
    codigoPos?: string;
    codigoGenerico?: string;
    visible?: boolean;
    unidadMedida?: string;
    codigoMoneda?: string;
  }>;
}

@Injectable()
export class StoreBootstrapService {
  private readonly logger = new Logger(StoreBootstrapService.name);
  private isBootstrapping = false;

  constructor(private readonly prisma: PrismaService) {}

  getBaseSyncUrl(): string {
    const raw = (process.env.BACKOFFICE_SYNC_URL || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    return raw.endsWith('/sync') ? raw : `${raw}/sync`;
  }

  async getLocalConfigVersion(storeCode: string): Promise<number> {
    try {
      const configRow = await this.prisma.configuracionTienda.findUnique({
        where: { idTienda: storeCode },
      });
      const cfg = configRow?.config as any;
      if (typeof cfg?.configVersion === 'number') {
        return cfg.configVersion;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async bootstrapStoreConfig(force = false): Promise<BootstrapResult> {
    const syncUrl = this.getBaseSyncUrl();
    if (!syncUrl) {
      this.logger.debug('BACKOFFICE_SYNC_URL no configurado, omitiendo bootstrap centralizado');
      return { applied: false, reason: 'NOT_CONFIGURED' };
    }

    if (this.isBootstrapping) {
      return { applied: false, reason: 'UP_TO_DATE' };
    }

    this.isBootstrapping = true;
    const storeCode = (process.env.STORE_CODE || '001').trim();
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    try {
      const localVersion = await this.getLocalConfigVersion(storeCode);
      const url = `${syncUrl}/down/config?storeCode=${encodeURIComponent(storeCode)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let payload: RemoteProvisioningPayload;
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'x-sync-key': syncKey },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        payload = (await res.json()) as RemoteProvisioningPayload;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!payload || typeof payload.configVersion !== 'number') {
        return { applied: false, reason: 'INVALID_RESPONSE' };
      }

      if (!force && payload.configVersion <= localVersion && localVersion > 0) {
        this.logger.debug(
          `Configuración de tienda ${storeCode} está al día (versión local: ${localVersion}, remota: ${payload.configVersion})`,
        );
        return { applied: false, reason: 'UP_TO_DATE', configVersion: localVersion };
      }

      this.logger.log(
        `Aplicando aprovisionamiento de tienda ${storeCode} (versión local: ${localVersion} -> remota: ${payload.configVersion})...`,
      );

      // Aplicar de forma atómica en transacción
      await this.applyConfigTransaction(storeCode, payload);

      this.logger.log(
        `Aprovisionamiento completado con éxito para tienda ${storeCode} (versión ${payload.configVersion}, ${payload.mangueras?.length || 0} mangueras)`,
      );

      return {
        applied: true,
        reason: 'APPLIED',
        storeCode,
        configVersion: payload.configVersion,
        hosesCount: payload.mangueras?.length || 0,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Error de red con Matriz';
      this.logger.warn(`No se pudo sincronizar configuración de tienda desde Matriz: ${errorMsg}`);
      return { applied: false, reason: 'OFFLINE', error: errorMsg };
    } finally {
      this.isBootstrapping = false;
    }
  }

  /**
   * Ejecuta la transacción atómica de persistencia.
   * NOTA CRÍTICA DE GOBERNANZA SAR:
   * Este método NUNCA interactúa con la tabla 'series_documento' (SAR).
   * Los rangos de facturación, CAI y correlativos permanecen 100% locales.
   */
  async applyConfigTransaction(storeCode: string, payload: RemoteProvisioningPayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Moneda base si es necesaria
      const codMoneda = payload.tienda?.codigoMoneda || 'HNL';
      if (tx.moneda?.upsert) {
        await tx.moneda.upsert({
          where: { codigo: codMoneda },
          update: { activa: true },
          create: {
            codigo: codMoneda,
            descripcion: codMoneda === 'HNL' ? 'Lempiras' : codMoneda,
            simbolo: codMoneda === 'HNL' ? 'L.' : codMoneda,
            decimales: 2,
            activa: true,
          },
        }).catch(() => {});
      }

      // 2. Upsert Tienda
      const t = payload.tienda || ({} as any);
      await tx.tienda.upsert({
        where: { idTienda: storeCode },
        update: {
          nombre: t.nombre ?? undefined,
          rtn: t.rtn ?? undefined,
          emisor: t.emisor ?? undefined,
          direccion1: t.direccion1 ?? undefined,
          telefono: t.telefono ?? undefined,
          correo: t.correo ?? undefined,
          moneda: t.moneda || 'HNL',
          codigoMoneda: codMoneda,
          ipFusion: t.ipFusion ?? undefined,
          urlControlador: t.urlControlador ?? undefined,
          claveControlador: t.claveControlador ?? undefined,
          esControladorGas: t.esControladorGas ?? false,
          variasLineasPermitidas: t.variasLineasPermitidas ?? true,
          descuentosPermitidos: t.descuentosPermitidos ?? true,
          casaMatriz: t.casaMatriz ?? undefined,
          codigoConsumidorFinal: t.noConsumidorFinal ?? undefined,
        },
        create: {
          idTienda: storeCode,
          nombre: t.nombre || `Estación ${storeCode}`,
          rtn: t.rtn || null,
          emisor: t.emisor || null,
          direccion1: t.direccion1 || null,
          telefono: t.telefono || null,
          correo: t.correo || null,
          moneda: t.moneda || 'HNL',
          codigoMoneda: codMoneda,
          ipFusion: t.ipFusion || '192.168.10.51',
          urlControlador: t.urlControlador || 'http://localhost:5008',
          claveControlador: t.claveControlador || null,
          esControladorGas: t.esControladorGas ?? false,
          variasLineasPermitidas: t.variasLineasPermitidas ?? true,
          descuentosPermitidos: t.descuentosPermitidos ?? true,
          casaMatriz: t.casaMatriz || null,
          codigoConsumidorFinal: t.noConsumidorFinal || null,
        },
      });

      // 3. Upsert ConfiguracionPos
      const p = payload.configuracionPos || ({} as any);
      const posCode = p.codigoPos || '01';
      await tx.configuracionPos.upsert({
        where: { codigoPos: posCode },
        update: {
          pantallaEnBomba: p.pantallaEnBomba ?? undefined,
          bloquearSoloPos: p.bloquearSoloPos ?? undefined,
          mostrarVideoPublicidad: p.mostrarVideoPublicidad ?? undefined,
          reimprimirVarios: p.reimprimirVarios ?? undefined,
          facturarVariasLineas: p.facturarVariasLineas ?? undefined,
          descuentoManual: p.descuentoManual ?? undefined,
          ocultarBotonOtrasBombas: p.ocultarBotonOtrasBombas ?? undefined,
          ocultarInformacionTurnos: p.ocultarInformacionTurnos ?? undefined,
          mostrarBombas: p.mostrarBombas ?? undefined,
          numTransaccionesBombas: p.numTransaccionesBombas ?? undefined,
          minutosAtrasada: p.minutosAtrasada ?? undefined,
          mostrarTeclado: p.mostrarTeclado ?? undefined,
          declararMontosIniciales: p.declararMontosIniciales ?? undefined,
          config: p.config ?? undefined,
        },
        create: {
          codigoPos: posCode,
          pantallaEnBomba: p.pantallaEnBomba ?? false,
          bloquearSoloPos: p.bloquearSoloPos ?? false,
          mostrarVideoPublicidad: p.mostrarVideoPublicidad ?? false,
          reimprimirVarios: p.reimprimirVarios ?? true,
          facturarVariasLineas: p.facturarVariasLineas ?? true,
          descuentoManual: p.descuentoManual ?? true,
          ocultarBotonOtrasBombas: p.ocultarBotonOtrasBombas ?? false,
          ocultarInformacionTurnos: p.ocultarInformacionTurnos ?? false,
          mostrarBombas: p.mostrarBombas ?? true,
          numTransaccionesBombas: p.numTransaccionesBombas ?? 400,
          minutosAtrasada: p.minutosAtrasada ?? 60,
          mostrarTeclado: p.mostrarTeclado ?? true,
          declararMontosIniciales: p.declararMontosIniciales ?? true,
          config: p.config || null,
        },
      });

      // 4. Upsert Mangueras
      for (const h of payload.mangueras || []) {
        await tx.manguera.upsert({
          where: { idManguera: h.idManguera },
          update: {
            idBomba: h.idBomba ?? undefined,
            idMangueraFisica: h.idMangueraFisica ?? undefined,
            numeroGrado: h.numeroGrado ?? undefined,
            nombreGrado: h.nombreGrado ?? undefined,
            idsTanques: h.idsTanques ?? undefined,
            pos: h.pos ?? undefined,
            codigoPos: h.codigoPos ?? undefined,
            codigoGenerico: h.codigoGenerico ?? undefined,
            visible: h.visible ?? undefined,
            unidadMedida: h.unidadMedida ?? undefined,
            codigoMoneda: h.codigoMoneda || codMoneda,
          },
          create: {
            idManguera: h.idManguera,
            idBomba: h.idBomba || 1,
            idMangueraFisica: h.idMangueraFisica || h.idManguera,
            numeroGrado: h.numeroGrado || 1,
            nombreGrado: h.nombreGrado || 'Combustible',
            idsTanques: h.idsTanques || null,
            pos: h.pos || '1',
            codigoPos: h.codigoPos || '1',
            codigoGenerico: h.codigoGenerico || '1',
            visible: h.visible ?? true,
            unidadMedida: h.unidadMedida || 'GL',
            codigoMoneda: h.codigoMoneda || codMoneda,
          },
        });
      }

      // 5. Version metadata en configuracion_tienda
      const existingConfig = await tx.configuracionTienda.findUnique({
        where: { idTienda: storeCode },
      });
      const meta = (existingConfig?.config as any) || {};
      await tx.configuracionTienda.upsert({
        where: { idTienda: storeCode },
        update: {
          config: {
            ...meta,
            configVersion: payload.configVersion,
            lastProvisionedAt: new Date().toISOString(),
          },
        },
        create: {
          idTienda: storeCode,
          config: {
            configVersion: payload.configVersion,
            lastProvisionedAt: new Date().toISOString(),
          },
        },
      });
    });
  }
}

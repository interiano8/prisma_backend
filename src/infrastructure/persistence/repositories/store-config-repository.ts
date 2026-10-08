import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Tienda } from '../../../generated/prisma/client';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';
import type { StoreConfig } from '../../../domain/entities/store-config.entity';

@Injectable()
export class StoreConfigRepositoryImpl implements StoreConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStoreId(storeId: string): Promise<StoreConfig | null> {
    try {
      const row = await this.prisma.tienda.findUnique({
        where: { idTienda: storeId },
      });
      if (!row) return null;
      return this.mapStoreConfig(row);
    } catch {
      return null;
    }
  }

  async findBlockedForPendingTransactions(storeId: string): Promise<boolean> {
    try {
      const row = await this.prisma.tienda.findUnique({
        where: { idTienda: storeId },
        select: { bloqueadoTransaccionesPendientes: true },
      });
      return row?.bloqueadoTransaccionesPendientes === true;
    } catch {
      return false;
    }
  }

  async findBlockedForPendingBomba(_storeId: string): Promise<boolean> {
    return false;
  }

  async findBlockedForPendingTurno(_storeId: string): Promise<boolean> {
    return false;
  }

  async findHideShiftInfo(posCode: string): Promise<boolean> {
    try {
      const row = await this.prisma.configuracionPos.findUnique({
        where: { codigoPos: posCode },
        select: { ocultarInformacionTurnos: true },
      });
      return row?.ocultarInformacionTurnos === true;
    } catch {
      return false;
    }
  }

  async findExchangeRate(fecha: string): Promise<number> {
    try {
      const day = this.parseDate(fecha);
      const row = await this.prisma.tasaCambio.findFirst({
        where: { fecha: { lte: day } },
        orderBy: { fecha: 'desc' },
      });
      return row ? Number(row.tasa) || 0 : 0;
    } catch {
      return 0;
    }
  }

  async findTasaByGrupo(codigo: string): Promise<number> {
    try {
      const row = await this.prisma.grupoImpuesto.findUnique({
        where: { codigo: codigo || '' },
      });
      return row ? Number(row.tasa) || 0 : 0;
    } catch {
      return 0;
    }
  }

  async findCreditCheckTimeoutMs(storeId?: string): Promise<number> {
    try {
      if (storeId && this.prisma.configuracionTienda) {
        const storeCfg = await this.prisma.configuracionTienda.findUnique({
          where: { idTienda: storeId },
        });
        const cfg = storeCfg?.config as any;
        if (cfg?.timeoutConsultaSaldoMs && Number(cfg.timeoutConsultaSaldoMs) > 0) {
          return Number(cfg.timeoutConsultaSaldoMs);
        }
      }
      if (this.prisma.configuracionTienda) {
        const firstCfg = await this.prisma.configuracionTienda.findFirst();
        const cfg = firstCfg?.config as any;
        if (cfg?.timeoutConsultaSaldoMs && Number(cfg.timeoutConsultaSaldoMs) > 0) {
          return Number(cfg.timeoutConsultaSaldoMs);
        }
      }
      return 1500;
    } catch {
      return 1500;
    }
  }

  async update(
    storeId: string,
    data: Partial<StoreConfig>,
  ): Promise<StoreConfig> {
    const row = await this.prisma.tienda.findUnique({
      where: { idTienda: storeId },
    });
    if (!row) {
      throw new Error(`Store ${storeId} not found`);
    }

    const next = { ...row };
    if (data.storeName !== undefined) next.nombre = data.storeName;
    if (data.moneda !== undefined) {
      next.moneda = data.moneda;
      await this.prisma.tienda.update({
        where: { idTienda: storeId },
        data: { moneda: data.moneda },
      });
    }
    if (data.carpetaMultimedia !== undefined) {
      next.carpetaMultimedia = data.carpetaMultimedia;
      await this.prisma.tienda.update({
        where: { idTienda: storeId },
        data: { carpetaMultimedia: data.carpetaMultimedia },
      });
    }

    return this.mapStoreConfig(next);
  }

  private parseDate(fecha: string): Date {
    const d = new Date(fecha);
    if (!isNaN(d.getTime())) return d;
    if (/^\d{8}$/.test(fecha)) {
      return new Date(
        Number(fecha.slice(0, 4)),
        Number(fecha.slice(4, 6)) - 1,
        Number(fecha.slice(6, 8)),
      );
    }
    return new Date();
  }

  private mapStoreConfig(row: Tienda): StoreConfig {
    return {
      storeId: row.idTienda,
      storeName: row.nombre || row.casaMatriz || '',
      posNumber: '',
      rtf: row.rtn || '',
      phone: row.telefono || '',
      email: row.correo || '',
      address: row.direccion1 || '',
      isGasStation: row.esControladorGas === true,
      isGasController: row.esControladorGas === true,
      ipFusionController: row.ipFusion || '',
      claveControlador: row.claveControlador || '',
      isFusionAssigned: false,
      isLealEnabled: row.lealHabilitado === true,
      urlLeal: row.urlLeal || '',
      descuentoManual: row.descuentosPermitidos === true,
      facturarVariasLineas: row.variasLineasPermitidas === true,
      screenOnPump: true,
      casaMatriz: row.casaMatriz || '',
      name: row.nombre || '',
      rtn: row.rtn || '',
      country: '',
      state: '',
      city: '',
      address1: row.direccion1 || '',
      address2: '',
      address3: '',
      passAdmin: row.contrasenaAdmin || '',
      turnos: null,
      caras: [],
      d3: '',
      d4: '',
      numberOfTransactionsWaiting: null,
      codeCountry: '',
      warningNewInvoiceRanges: null,
      warningNewCreditNotesRanges: null,
      urlControlador: row.urlControlador || '',
      blockedForPendingTransactions:
        row.bloqueadoTransaccionesPendientes === true,
      debugMode: false,
      noConsumidorFinal: row.codigoConsumidorFinal || '',
      urlSaldo: '',
      validarRFID: false,
      validarSaldoCredito: row.validarSaldoCredito !== false,
      voxIsActive: false,
      rangoIndividual: false,
      facturacionOrdenada: false,
      erp: '',
      urlActualizacion: '',
      urlBaseERP: '',
      turnoManual: false,
      calculoInverso: false,
      campanas: row.campanas === true,
      nombreBotonFidelizacion: row.nombreBotonFidelizacion || 'LEAL',
      moneda: row.moneda || 'L.',
      carpetaMultimedia: row.carpetaMultimedia || '',
    };
  }
}

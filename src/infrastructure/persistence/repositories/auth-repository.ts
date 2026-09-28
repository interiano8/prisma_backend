import { Injectable } from '@nestjs/common';
import type { Empleado, Tienda } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AuthRepository,
  RawStore,
  ActiveShiftResult,
} from '../../../domain/ports/out/auth-repository.interface';
import { User } from '../../../domain/entities/user.entity';
import { StoreConfig } from '../../../domain/entities/store-config.entity';
import { verifyPasswordHash } from '../../security/hash-utils';
import { toServerIso } from '../../../utils/datetime';

@Injectable()
export class AuthRepositoryImpl implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByUsername(username: string): Promise<User | null> {
    const cleanUsername = username?.trim() || '';
    if (!cleanUsername) return null;
    const row = await this.prisma.empleado.findFirst({
      where: { usuario: { equals: cleanUsername, mode: 'insensitive' } },
      include: {
        roles: {
          include: {
            rol: {
              include: {
                permisos: {
                  select: { idPermiso: true },
                },
              },
            },
          },
        },
      },
    });
    if (!row) return null;
    return this.mapUser(row);
  }

  async listEmployees(): Promise<{ usuario: string; nombre: string }[]> {
    const rows = await this.prisma.empleado.findMany({
      where: { estaActivo: true },
      select: { usuario: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({
      usuario: r.usuario,
      nombre: r.nombre || r.usuario,
    }));
  }

  async findUserByRfid(rfidCode: string): Promise<User | null> {
    const employees = await this.prisma.empleado.findMany({
      where: { estaActivo: true, codigoRfid: { not: null } },
      include: {
        roles: {
          include: {
            rol: {
              include: {
                permisos: {
                  select: { idPermiso: true },
                },
              },
            },
          },
        },
      },
    });
    for (const emp of employees) {
      const storedRfid = (emp.codigoRfid || '').trim();
      if (!storedRfid) continue;
      if (verifyPasswordHash(storedRfid, rfidCode) || storedRfid === rfidCode) {
        return this.mapUser(emp);
      }
    }
    return null;
  }

  async findStoreByStoreId(storeId: string): Promise<StoreConfig | null> {
    const row = await this.prisma.tienda.findUnique({
      where: { idTienda: storeId },
    });
    if (!row) return null;
    return this.mapStoreConfig(row);
  }

  async findStoreRaw(storeId: string): Promise<RawStore | null> {
    const row = await this.prisma.tienda.findUnique({
      where: { idTienda: storeId },
    });
    if (!row) return null;
    return this.toRawStore(row);
  }

  async findTpvConfig(posNo: string): Promise<unknown> {
    const row = await this.prisma.configuracionPos.findUnique({
      where: { codigoPos: posNo },
    });
    if (row?.config) return row.config;
    return null;
  }

  async findPosConfig(posNo: string): Promise<{
    mostrarBombas: boolean;
    ocultarBotonOtrasBombas: boolean;
    numTransaccionesBombas: number;
    minutosAtrasada: number;
    mostrarTeclado: boolean;
    declararMontosIniciales: boolean;
    caras: number[];
  } | null> {
    const row = await this.prisma.configuracionPos.findUnique({
      where: { codigoPos: posNo },
    });
    if (!row) return null;
    return {
      mostrarBombas: row.mostrarBombas === true,
      ocultarBotonOtrasBombas: row.ocultarBotonOtrasBombas === true,
      numTransaccionesBombas: row.numTransaccionesBombas ?? 20,
      minutosAtrasada: row.minutosAtrasada ?? 10,
      mostrarTeclado: row.mostrarTeclado !== false,
      declararMontosIniciales: row.declararMontosIniciales === true,
      caras: Array.isArray(row.caras)
        ? (row.caras as unknown[])
            .map((c) => Number(c))
            .filter((n) => Number.isFinite(n))
        : [],
    };
  }

  async findPassAdmin(storeId: string): Promise<string | null> {
    const row = await this.prisma.tienda.findUnique({
      where: { idTienda: storeId },
    });
    return row?.contrasenaAdmin || null;
  }

  async updatePassAdmin(storeId: string, hash: string): Promise<void> {
    await this.prisma.tienda.update({
      where: { idTienda: storeId },
      data: { contrasenaAdmin: hash },
    });
  }

  async checkCreditValidation(storeId: string): Promise<boolean> {
    const row = await this.prisma.tienda.findUnique({
      where: { idTienda: storeId },
    });
    return row?.validarSaldoCredito === true;
  }

  async getActiveShift(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<ActiveShiftResult> {
    try {
      let gasStationCode = storeId.trim();
      if (/^\d+$/.test(gasStationCode)) {
        gasStationCode = parseInt(gasStationCode, 10)
          .toString()
          .padStart(3, '0');
      }

      const shift = await this.prisma.turno.findFirst({
        where: {
          idTienda: gasStationCode,
          nombreEmpleado: employeeName,
          finTurno: null,
        },
        orderBy: { inicioTurno: 'desc' },
      });

      if (shift) {
        return {
          Shift: shift.turno?.toString() || '1',
          'POS Transaction ID': shift.idTransaccionPos || 'TX-DEFAULT',
          'Shift Starting': toServerIso(shift.inicioTurno),
          MontoInicial: shift.montoInicial ?? 0,
          EmployeeName: shift.nombreEmpleado || employeeName,
        };
      }
    } catch (err) {
      console.error('Error in getActiveShift:', err);
    }
    return { Message: 'No open shift found', Shift: null };
  }

  private mapUser(row: any): User {
    const activeRoles = (row.roles || [])
      .map((r: any) => r.rol)
      .filter((rol: any) => rol && rol.estaActivo !== false);
    const roles: string[] = activeRoles.map((r: any) => r.id);

    if (roles.length === 0 && row.perfil) {
      roles.push(row.perfil);
    }

    const permissionSet = new Set<string>();
    for (const r of activeRoles) {
      for (const p of r.permisos || []) {
        if (p.idPermiso) permissionSet.add(p.idPermiso);
      }
    }

    return {
      id: row.id,
      username: row.usuario,
      name: row.nombre || '',
      profile: row.perfil || '',
      isActive: row.estaActivo === true,
      passwordHash: row.hashContrasena || undefined,
      codigoRfid: row.codigoRfid || undefined,
      pinLeal: row.pin || undefined,
      preferencias:
        row.preferencias != null
          ? (row.preferencias as { theme?: string; accent?: string })
          : null,
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  async savePreferences(
    username: string,
    preferences: { theme?: string; accent?: string },
  ): Promise<void> {
    await this.prisma.empleado.update({
      where: { usuario: username },
      data: { preferencias: preferences },
    });
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
      validarSaldoCredito: row.validarSaldoCredito === true,
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

  // Traduce la tienda (nuevos nombres) a los nombres originales de Dynamics
  // para que AuthService.mapStoreConfig funcione sin cambios.
  private toRawStore(row: Tienda): RawStore {
    return {
      StoreID: row.idTienda,
      Titulo: row.casaMatriz,
      Name: row.nombre,
      RTN: row.rtn,
      Country: null,
      State: null,
      City: null,
      Address1: row.direccion1,
      Address2: null,
      Address3: null,
      Phone: row.telefono,
      Email: row.correo,
      PassAdmin: row.contrasenaAdmin,
      Turnos: null,
      D3: null,
      D4: null,
      NumberOfTransactionsWaiting: null,
      URLLEAL: row.urlLeal,
      isLealEnabled: row.lealHabilitado === true ? 1 : 0,
      CodeCountry: null,
      IsGasController: row.esControladorGas === true ? 1 : 0,
      WarningNewInvoiceRanges: null,
      WarningNewCreditNotesRanges: null,
      IsFusionAssigned: 0,
      IPFusionController: row.ipFusion,
      UrlControlador: row.urlControlador,
      MultipleItemsAllowed: row.variasLineasPermitidas === true ? 1 : 0,
      AllowedToApplyDiscounts: row.descuentosPermitidos === true ? 1 : 0,
      BlockedForPendingTransactions:
        row.bloqueadoTransaccionesPendientes === true ? 1 : 0,
      DebugMode: 0,
      ClaveControlador: row.claveControlador,
      NoConsumidorFinal: row.codigoConsumidorFinal,
      URLSaldo: null,
      ValidarRFID: 0,
      ValidarSaldoCredito: row.validarSaldoCredito === true ? 1 : 0,
      VoxIsActive: 0,
      RangoIndividual: 0,
      FacturacionOrdenada: 0,
      ERP: null,
      Url_Actualizacion: null,
      URLBaseERP: null,
      Turno_Manual: 0,
      Calculo_Inverso: 0,
      Campanas: row.campanas === true ? 1 : 0,
      DeclararMontoInicial: 0,
    };
  }
}

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LealCrypto } from './leal-crypto';
import { LealAuthClient, LealApiEnvelope } from './leal-auth-client';
import {
  LealRepository,
  LealCustomerResult,
  LealTotales,
} from '../../../domain/ports/out/leal-repository.interface';
import {
  LealLoginResponse,
  LealCustomer,
} from '../../../domain/entities/leal-transaction.entity';
import * as crypto from 'crypto';

interface LealUserInfo {
  uid?: string;
  cedula?: string;
  nombre?: string;
  name?: string;
  apellido?: string;
  fullname?: string;
  email?: string;
  celular?: string;
  phone?: string;
  puntos_activos?: number | string;
  puntos?: number | string;
  estado?: string | number;
  status?: string;
  tier?: string;
  id_comercio?: string | number;
  id_sucursal?: string | number;
  uid_cms?: string;
  tiene_otp?: number | string | boolean;
}


@Injectable()
export class LealRepositoryImpl implements LealRepository {
  private readonly logger = new Logger(LealRepositoryImpl.name);
  private readonly crypto = new LealCrypto();
  private readonly auth: LealAuthClient;

  constructor(private readonly prisma: PrismaService) {
    this.auth = new LealAuthClient(prisma);
  }

  get cachedToken(): string | null {
    return this.auth.cachedToken;
  }

  set cachedToken(v: string | null) {
    this.auth.cachedToken = v;
  }

  get cachedUrlLeal(): string | null {
    return this.auth.cachedUrlLeal;
  }

  set cachedUrlLeal(v: string | null) {
    this.auth.cachedUrlLeal = v;
  }

  get cachedUserLeal(): string | null {
    return this.auth.cachedUserLeal;
  }

  set cachedUserLeal(v: string | null) {
    this.auth.cachedUserLeal = v;
  }

  get cachedPassLeal(): string | null {
    return this.auth.cachedPassLeal;
  }

  set cachedPassLeal(v: string | null) {
    this.auth.cachedPassLeal = v;
  }

  get cachedRefreshToken(): string | null {
    return this.auth.cachedRefreshToken;
  }

  set cachedRefreshToken(v: string | null) {
    this.auth.cachedRefreshToken = v;
  }




  private decryptAes(ciphertext: string): string {
    return this.crypto.decrypt(ciphertext);
  }

  private encryptAes(plaintext: string): string {
    return this.crypto.encrypt(plaintext);
  }

  private async getStoreIdFallback(): Promise<string> {
    return this.auth.getStoreIdFallback();
  }

  private async loadConfigAndCredentials(): Promise<void> {
    await this.auth.loadConfig();
  }

  async login(credentials: {
    username?: string;
    password?: string;
    storeId?: string;
  }): Promise<LealLoginResponse> {
    return this.auth.login(credentials) as unknown as LealLoginResponse;
  }

  private extractUser(data: LealApiEnvelope): LealUserInfo | undefined {
    return this.auth.extractUser(data);
  }

  private async refreshToken(): Promise<boolean> {
    return this.auth.refreshToken();
  }

  async executeWithAuth(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    isRetry: boolean = false,
  ): Promise<LealApiEnvelope> {
    return this.auth.executeWithAuth(endpoint, method, body, isRetry);
  }

  async checkStatus(): Promise<{
    connected: boolean;
    idComercio?: any;
    tieneOtp?: boolean;
  }> {
    try {
      const data = await this.auth.executeWithAuth('com_usuarios/me', 'GET');
      if (data && data.code === 100) {
        const meUser = this.extractUser(data);
        this.auth.updateIdentity(meUser);
        const rawOtp = meUser?.tiene_otp;
        const tieneOtp =
          rawOtp === 1 ||
          rawOtp === '1' ||
          rawOtp === true ||
          rawOtp === 'true';
        return {
          connected: true,
          idComercio: this.auth.getIdentity().idComercio,
          tieneOtp,
        };
      }
      return { connected: false };
    } catch (e) {
      this.logger.error('Error checking Leal status', e);
      return { connected: false };
    }
  }

  async generateOtp(
    uid: string,
    idPremio?: number,
    idSucursal?: string,
  ): Promise<any> {
    await this.auth.ensureLoggedIn();

    const ident = this.auth.getIdentity();
    let idComercio = ident.idComercio;
    if (!idComercio) {
      idComercio = await this.auth.getStoreIdFallback();
    }

    const body: Record<string, any> = {
      uid: uid,
      uid_cms: ident.uidCms ?? uid,
      id_comercio:
        typeof idComercio === 'string' ? parseInt(idComercio, 10) : idComercio,
      id_sucursal: idSucursal ?? ident.idSucursal ?? '',
    };
    if (idPremio != null) body.id_premio = idPremio;

    const result = await this.auth.executeWithAuth(
      `usu_historial_puntos/generarOTPRedencion`,
      'POST',
      body,
    );

    if (result.code !== 100) {
      throw new BadRequestException(
        result.mensaje || result.message || 'Error al generar OTP',
      );
    }
    return result;
  }

  async searchCustomer(
    documentId: string,
    soloCedula: string,
    token: string,
  ): Promise<LealCustomerResult | null> {
    await this.auth.ensureLoggedIn();

    void token;

    const ident = this.auth.getIdentity();
    let idComercio = ident.idComercio;
    if (!idComercio) {
      const storeId = await this.auth.getStoreIdFallback();
      idComercio = storeId;
    }

    const url =
      soloCedula === 's'
        ? `usu_usuarios/buscar_usuario/${idComercio}/${documentId}?soloCedula=s`
        : `usu_usuarios/buscar_usuario/${idComercio}/${documentId}`;
    console.log(`[LealRepository] GET ${url}`);
    const data = await this.auth.executeWithAuth(url);
    console.log(`[LealRepository] GET ${url} RESPONSE:`, JSON.stringify(data));

    if (data.code === 100) {
      const user = this.extractUser(data);
      if (!user) return null;
      return {
        uid: user.uid || '',
        documentId: user.cedula || documentId,
        nombre: user.nombre || user.name || '',
        apellido: user.apellido || '',
        fullname: user.fullname || '',
        email: user.email || '',
        celular: user.celular || user.phone || '',
        puntos: Number(user.puntos_activos || user.puntos || 0),
        status: String(user.estado || user.status || ''),
        tier: user.tier || '',
      };
    }
    return null;
  }

  async getPremios(uid: string, token: string): Promise<any> {
    void token;
    const data = await this.auth.executeWithAuth(
      `com_comercios/premios-homologados/${uid}`,
    );
    if (data && data.code === 100) {
      const raw = data.data;
      if (
        raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        'premios' in raw
      ) {
        return (raw as { premios?: any[] }).premios || [];
      }
      return [];
    }
    return [];
  }

  registerCustomer(data: {
    documentId: string;
    name: string;
    email: string;
    phone: string;
    token: string;
  }): Promise<LealCustomer> {
    void data;
    return Promise.reject(
      new Error(
        'Method not completely implemented yet. Depends on specific Leal requirements.',
      ),
    );
  }

  async accumulatePoints(data: {
    customerId: string;
    invoiceNo: string;
    noFactura?: string;
    total: number;
    token: string;
    totales?: LealTotales;
    pin?: string;
  }): Promise<any> {
    await this.auth.ensureLoggedIn();

    const ident = this.auth.getIdentity();
    let idComercio = ident.idComercio;
    if (!idComercio) {
      const storeId = await this.auth.getStoreIdFallback();
      idComercio = storeId;
    }

    const effectiveNoFactura = data.noFactura ?? data.invoiceNo;
    const body: Record<string, unknown> = {
      totalAcum: data.total,
      nota: `Factura: ${data.invoiceNo}`,
      uid: data.customerId,
      transaccion: {
        clave: effectiveNoFactura,
        noFactura: effectiveNoFactura,
        fecha: data.totales?.Fecha,
        fechaApertura: data.totales?.FechaApertura,
        fechaCierre: data.totales?.FechaCierre,
        totalPersonas: data.totales?.TotalPersonas || 1,
        formaPago: data.totales?.FormaPago || '',
        codVendedor: '',
        subTotal: data.totales?.SubTotal || 0,
        propina: 0,
        impuestoTotal: data.totales?.ImpuestoTotal || 0,
        descuentoTotal: data.totales?.DescuentoTotal || 0,
        items: data.totales?.Items || [],
      },
    };

    if (data.pin && data.pin.trim().length > 0) {
      body.pin = data.pin.trim();
    }

    const result = await this.auth.executeWithAuth(
      `usu_historial_puntos/cargar_factura/${idComercio}`,
      'POST',
      body,
    );

    if (result.code !== 100) {
      throw new BadRequestException(
        result.mensaje || result.message || 'Error al acumular',
      );
    }
    return result;
  }

  async redeemPoints(data: {
    customerId: string;
    points: number;
    invoiceNo: string;
    token: string;
    idPremio?: number;
    otp?: string;
    pin?: string;
    nota?: string;
  }): Promise<any> {
    await this.auth.ensureLoggedIn();

    const ident = this.auth.getIdentity();
    let idComercio = ident.idComercio;
    if (!idComercio) {
      const storeId = await this.auth.getStoreIdFallback();
      idComercio = storeId;
    }

    const body: Record<string, unknown> = {
      id_comercio:
        typeof idComercio === 'string' ? parseInt(idComercio, 10) : idComercio,
      id_sucursal: this.auth.getIdentity().idSucursal ?? '',
      uid: data.customerId,
      factura: data.invoiceNo,
      valor: data.points,
    };

    if (data.idPremio) body.id_premio = data.idPremio;
    if (data.otp) body.OTP = data.otp;
    if (data.pin) body.pin = data.pin;
    if (data.nota) body.nota = data.nota;

    const result = await this.auth.executeWithAuth(
      `usu_historial_puntos/redimir_puntos`,
      'POST',
      body,
    );

    if (result.code !== 100) {
      throw new BadRequestException(
        result.mensaje || result.message || 'Error al redimir',
      );
    }
    return result;
  }

  reverseTransaction(
    transactionId: string,
    invoiceNo: string,
    token: string,
  ): Promise<any> {
    void transactionId;
    void invoiceNo;
    void token;
    return Promise.reject(
      new Error(
        'Reversión en Leal no implementada: falta el endpoint de la API de Leal.',
      ),
    );
  }

  async getCredentials(): Promise<{ user: string; pass: string }> {
    return this.auth.getCredentials();
  }

  async updateCredentials(user: string, pass: string): Promise<void> {
    try {
      const encUser = this.crypto.encrypt(user);
      const encPass = this.crypto.encrypt(pass);

      const existing = await this.prisma.configuracionLeal.findFirst();

      if (!existing) {
        await this.prisma.configuracionLeal.create({
          data: { usuario: encUser, contrasena: encPass },
        });
      } else {
        await this.prisma.configuracionLeal.update({
          where: { id: existing.id },
          data: { usuario: encUser, contrasena: encPass },
        });
      }

      this.auth.setCredentials(user, pass);

      let loginSuccess = false;
      try {
        await this.auth.login({ username: user.trim(), password: pass.trim() });
        loginSuccess = true;
      } catch (e) {
        this.logger.error('Failed to login to Leal with new credentials', e);
        throw new BadRequestException(
          'Credenciales guardadas, pero falló la conexión con Leal. Verifica el usuario/contraseña.',
        );
      }

      if (loginSuccess) {
        await this.prisma.tienda.updateMany({ data: { lealHabilitado: true } });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to update credentials', error);
      throw new InternalServerErrorException(
        'Error al actualizar credenciales',
      );
    }
  }
}

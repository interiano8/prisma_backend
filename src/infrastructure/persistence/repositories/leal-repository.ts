import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LealCrypto } from './leal-crypto';
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

interface LealApiEnvelope {
  code: number;
  message?: string;
  mensaje?: string;
  token?: string;
  refresh_token?: string;
  id_rol?: string | number;
  plataforma?: string;
  user?: LealUserInfo | LealUserInfo[];
  data?: LealUserInfo | LealUserInfo[] | { user?: LealUserInfo };
  premios?: any[];
}

@Injectable()
export class LealRepositoryImpl implements LealRepository {
  private readonly logger = new Logger(LealRepositoryImpl.name);
  private readonly crypto = new LealCrypto();

  private cachedUrlLeal: string | null = null;
  private cachedUserLeal: string | null = null;
  private cachedPassLeal: string | null = null;

  private cachedToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  private cachedIdComercio: string | number | null = null;
  private cachedIdSucursal: string | number | null = null;
  private cachedUidCms: string | null = null;

  constructor(private readonly prisma: PrismaService) {}




  private decryptAes(ciphertext: string): string {
    return this.crypto.decrypt(ciphertext);
  }

  private encryptAes(plaintext: string): string {
    return this.crypto.encrypt(plaintext);
  }

  private async getStoreIdFallback(): Promise<string> {
    const store = await this.prisma.tienda.findFirst();
    return store?.idTienda || '001';
  }

  private async loadConfigAndCredentials(): Promise<void> {
    if (this.cachedUrlLeal && this.cachedUserLeal && this.cachedPassLeal) {
      return;
    }

    const store = await this.prisma.tienda.findFirst();
    if (store) {
      this.cachedUrlLeal = store.urlLeal || null;
    }

    const leal = await this.prisma.configuracionLeal.findFirst();
    if (leal) {
      this.cachedUserLeal = this.crypto.decrypt(leal.usuario || '').trim();
      this.cachedPassLeal = this.crypto.decrypt(leal.contrasena || '').trim();
    }
  }

  async login(credentials: {
    username?: string;
    password?: string;
    storeId?: string;
  }): Promise<LealLoginResponse> {
    await this.loadConfigAndCredentials();

    const userToUse = credentials.username || this.cachedUserLeal;
    const passToUse = credentials.password || this.cachedPassLeal;

    if (!userToUse || !passToUse || !this.cachedUrlLeal) {
      throw new InternalServerErrorException(
        'Faltan credenciales o URLLEAL en la base de datos',
      );
    }

    const url = `${this.cachedUrlLeal.replace(/\/$/, '')}/com_usuarios/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: userToUse, contrasena: passToUse }),
    });

    let data: LealApiEnvelope | undefined;
    const textData = await response.text();
    try {
      data = JSON.parse(textData) as LealApiEnvelope;
      this.logger.debug('Login response received from Leal');
    } catch {
      throw new UnauthorizedException(
        'El servidor de Leal no respondió en el formato esperado (posible error de red o URL incorrecta).',
      );
    }

    if (data && data.code === 100) {
      this.cachedToken = data.token ?? null;
      this.cachedRefreshToken = data.refresh_token ?? null;

      try {
        const baseUrl = this.cachedUrlLeal || '';
        const meResponse = await fetch(
          `${baseUrl.replace(/\/$/, '')}/com_usuarios/me`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.cachedToken}`,
            },
          },
        );
        if (meResponse.ok) {
          const meData = (await meResponse.json()) as LealApiEnvelope;
          const meUser = this.extractUser(meData);
          this.cachedIdComercio = meUser?.id_comercio ?? null;
          this.cachedIdSucursal = meUser?.id_sucursal ?? null;
          this.cachedUidCms = meUser?.uid_cms ?? null;
        }
      } catch (e) {
        console.error('[LealRepository] Failed to fetch com_usuarios/me', e);
      }

      console.log(
        `[LealRepository] CACHED idComercio: ${this.cachedIdComercio}`,
      );
      return {
        code: data.code,
        message: data.message || 'Login exitoso',
        token: data.token ?? '',
        refresh_token: data.refresh_token ?? '',
        id_rol: data.id_rol,
        plataforma: data.plataforma,
      } as unknown as LealLoginResponse;
    }

    throw new UnauthorizedException(data?.message || 'Error en login Leal');
  }

  async checkStatus(): Promise<{
    connected: boolean;
    idComercio?: any;
    tieneOtp?: boolean;
  }> {
    try {
      const data = await this.executeWithAuth('com_usuarios/me', 'GET');
      if (data && data.code === 100) {
        const meUser = this.extractUser(data);
        this.cachedIdComercio = meUser?.id_comercio ?? this.cachedIdComercio;
        this.cachedIdSucursal = meUser?.id_sucursal ?? this.cachedIdSucursal;
        this.cachedUidCms = meUser?.uid_cms ?? this.cachedUidCms;

        const rawOtp = meUser?.tiene_otp;
        const tieneOtp =
          rawOtp === 1 ||
          rawOtp === '1' ||
          rawOtp === true ||
          rawOtp === 'true';

        return {
          connected: true,
          idComercio: this.cachedIdComercio,
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
    if (!this.cachedToken) {
      await this.login({});
    }

    let idComercio = this.cachedIdComercio;
    if (!idComercio) {
      const storeId = await this.getStoreIdFallback();
      idComercio = storeId;
    }

    const body: Record<string, any> = {
      uid: uid,
      uid_cms: this.cachedUidCms ?? uid,
      id_comercio:
        typeof idComercio === 'string' ? parseInt(idComercio, 10) : idComercio,
      id_sucursal: idSucursal ?? this.cachedIdSucursal ?? '',
    };
    if (idPremio != null) body.id_premio = idPremio;

    const result = await this.executeWithAuth(
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

  private extractUser(data: LealApiEnvelope): LealUserInfo | undefined {
    const user = data.user;
    if (Array.isArray(user)) return user[0];
    if (user) return user;
    const nested = data.data;
    if (!nested) return undefined;
    if (Array.isArray(nested)) return nested[0];
    if ('user' in nested) return nested.user;
    return nested as LealUserInfo;
  }

  private async refreshToken(): Promise<boolean> {
    if (!this.cachedRefreshToken || !this.cachedUrlLeal) return false;

    const url = `${this.cachedUrlLeal.replace(/\/$/, '')}/com_usuarios/refresh`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.cachedRefreshToken }),
      });
      const data = (await response.json()) as LealApiEnvelope;
      if (data && data.code === 100 && data.token) {
        this.cachedToken = data.token;
        return true;
      }
    } catch (e) {
      this.logger.error('Error refreshing token', e);
    }
    return false;
  }

  private async executeWithAuth(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    isRetry: boolean = false,
  ): Promise<LealApiEnvelope> {
    await this.loadConfigAndCredentials();

    if (!this.cachedToken) {
      await this.login({});
    }

    const baseUrl = this.cachedUrlLeal || '';
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cachedToken}`,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    options.signal = controller.signal;

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        `Error de red al llamar a Leal: ${err.message}`,
        err.stack,
      );
      if (
        err.name === 'AbortError' ||
        (err as NodeJS.ErrnoException).code === 'UND_ERR_HEADERS_TIMEOUT' ||
        err.message.includes('timeout')
      ) {
        throw new InternalServerErrorException(
          'Error al conectar con Leal: Tiempo de espera agotado.',
        );
      }
      throw new InternalServerErrorException(
        `Error de red con Leal: ${err.message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401) {
      if (!isRetry) {
        this.logger.log('Token expirado. Intentando refresh...');
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          this.logger.log('Refresh falló. Intentando login...');
          await this.login({});
        }
        return this.executeWithAuth(endpoint, method, body, true);
      } else {
        throw new UnauthorizedException(
          'No autorizado. Token inválido en Leal.',
        );
      }
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `HTTP Error from Leal API: ${response.status} ${response.statusText}`,
      );
    }

    const text = await response.text();
    if (text.startsWith('<')) {
      throw new InternalServerErrorException(
        'La API de Leal devolvió HTML inesperado.',
      );
    }

    const data = JSON.parse(text) as LealApiEnvelope;

    if (data.code === 120 && !isRetry) {
      this.logger.log('Respuesta LEAL code 120. Intentando refresh...');
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        await this.login({});
      }
      return this.executeWithAuth(endpoint, method, body, true);
    }

    return data;
  }

  async searchCustomer(
    documentId: string,
    soloCedula: string,
    token: string,
  ): Promise<LealCustomerResult | null> {
    if (!this.cachedToken) {
      await this.login({});
    }

    void token;

    let idComercio = this.cachedIdComercio;
    if (!idComercio) {
      const storeId = await this.getStoreIdFallback();
      idComercio = storeId;
    }

    const url =
      soloCedula === 's'
        ? `usu_usuarios/buscar_usuario/${idComercio}/${documentId}?soloCedula=s`
        : `usu_usuarios/buscar_usuario/${idComercio}/${documentId}`;
    console.log(`[LealRepository] GET ${url}`);
    const data = await this.executeWithAuth(url);
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
    const data = await this.executeWithAuth(
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
    if (!this.cachedToken) {
      await this.login({});
    }

    let idComercio = this.cachedIdComercio;
    if (!idComercio) {
      const storeId = await this.getStoreIdFallback();
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

    const result = await this.executeWithAuth(
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
    if (!this.cachedToken) {
      await this.login({});
    }

    let idComercio = this.cachedIdComercio;
    if (!idComercio) {
      const storeId = await this.getStoreIdFallback();
      idComercio = storeId;
    }

    const body: Record<string, unknown> = {
      id_comercio:
        typeof idComercio === 'string' ? parseInt(idComercio, 10) : idComercio,
      id_sucursal: this.cachedIdSucursal ?? '',
      uid: data.customerId,
      factura: data.invoiceNo,
      valor: data.points,
    };

    if (data.idPremio) body.id_premio = data.idPremio;
    if (data.otp) body.OTP = data.otp;
    if (data.pin) body.pin = data.pin;
    if (data.nota) body.nota = data.nota;

    const result = await this.executeWithAuth(
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
    await this.loadConfigAndCredentials();
    return {
      user: this.cachedUserLeal || '',
      pass: this.cachedPassLeal || '',
    };
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

      this.cachedUserLeal = user.trim();
      this.cachedPassLeal = pass.trim();
      this.cachedToken = null;

      let loginSuccess = false;
      try {
        await this.login({ username: user.trim(), password: pass.trim() });
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

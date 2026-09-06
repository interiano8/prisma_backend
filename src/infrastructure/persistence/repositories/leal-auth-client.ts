import { Injectable, Logger } from '@nestjs/common';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { LealCrypto } from './leal-crypto';

export interface LealApiEnvelope {
  code?: number;
  message?: string;
  mensaje?: string;
  token?: string;
  refresh_token?: string;
  id_rol?: number;
  plataforma?: string;
  user?: any;
  data?: any;
}

interface LealUserInfo {
  id_comercio?: string | number;
  id_sucursal?: string | number;
  uid_cms?: string;
  tiene_otp?: number | string | boolean;
}

export interface LealLoginResponse {
  code?: number;
  message?: string;
  token?: string;
  refresh_token?: string;
  id_rol?: number;
  plataforma?: string;
  [k: string]: unknown;
}

/**
 * Responsabilidad única: ciclo de vida de autenticación contra Leal
 * (config/credenciales, token, refresh, reintentos y red). El repositorio
 * delega aquí toda llamada autenticada.
 */
@Injectable()
export class LealAuthClient {
  private readonly logger = new Logger(LealAuthClient.name);
  private readonly crypto = new LealCrypto();

  private _cachedUrlLeal: string | null = null;
  private _cachedUserLeal: string | null = null;
  private _cachedPassLeal: string | null = null;

  cachedToken: string | null = null;
  private _cachedRefreshToken: string | null = null;

  get cachedUrlLeal(): string | null { return this._cachedUrlLeal; }
  set cachedUrlLeal(v: string | null) { this._cachedUrlLeal = v; }
  get cachedUserLeal(): string | null { return this._cachedUserLeal; }
  set cachedUserLeal(v: string | null) { this._cachedUserLeal = v; }
  get cachedPassLeal(): string | null { return this._cachedPassLeal; }
  set cachedPassLeal(v: string | null) { this._cachedPassLeal = v; }
  get cachedRefreshToken(): string | null { return this._cachedRefreshToken; }
  set cachedRefreshToken(v: string | null) { this._cachedRefreshToken = v; }
  private cachedIdComercio: string | number | null = null;
  private cachedIdSucursal: string | number | null = null;
  private cachedUidCms: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  getIdentity(): {
    idComercio: string | number | null;
    idSucursal: string | number | null;
    uidCms: string | null;
  } {
    return {
      idComercio: this.cachedIdComercio,
      idSucursal: this.cachedIdSucursal,
      uidCms: this.cachedUidCms,
    };
  }

  updateIdentity(user?: LealUserInfo): void {
    if (!user) return;
    if (user.id_comercio != null) this.cachedIdComercio = user.id_comercio;
    if (user.id_sucursal != null) this.cachedIdSucursal = user.id_sucursal;
    if (user.uid_cms != null) this.cachedUidCms = user.uid_cms;
  }

  getBaseUrl(): string {
    return this._cachedUrlLeal || '';
  }

  async getCredentials(): Promise<{ user: string; pass: string }> {
    await this.loadConfigAndCredentials();
    return { user: this._cachedUserLeal || '', pass: this._cachedPassLeal || '' };
  }

  setCredentials(user: string, pass: string): void {
    this._cachedUserLeal = user.trim();
    this._cachedPassLeal = pass.trim();
    this.cachedToken = null;
    this._cachedRefreshToken = null;
  }

  extractUser(data: any): any {
    return this.extractUserInternal(data);
  }

  async loadConfig(): Promise<void> {
    await this.loadConfigAndCredentials();
  }

  async ensureLoggedIn(): Promise<void> {
    if (!this.cachedToken) {
      await this.login({});
    }
  }

  async getStoreIdFallback(): Promise<string> {
    const store = await this.prisma.tienda.findFirst();
    return store?.idTienda || '001';
  }

  private async loadConfigAndCredentials(): Promise<void> {
    if (this._cachedUrlLeal && this._cachedUserLeal && this._cachedPassLeal) {
      return;
    }

    const store = await this.prisma.tienda.findFirst();
    if (store) {
      this._cachedUrlLeal = store.urlLeal || null;
    }

    const leal = await this.prisma.configuracionLeal.findFirst();
    if (leal) {
      this._cachedUserLeal = this.crypto.decrypt(leal.usuario || '').trim();
      this._cachedPassLeal = this.crypto.decrypt(leal.contrasena || '').trim();
    }
  }

  async login(credentials: {
    username?: string;
    password?: string;
    storeId?: string;
  }): Promise<LealLoginResponse> {
    await this.loadConfigAndCredentials();

    const userToUse = credentials.username || this._cachedUserLeal;
    const passToUse = credentials.password || this._cachedPassLeal;

    if (!userToUse || !passToUse || !this._cachedUrlLeal) {
      throw new InternalServerErrorException(
        'Faltan credenciales o URLLEAL en la base de datos',
      );
    }

    const url = `${this._cachedUrlLeal.replace(/\/$/, '')}/com_usuarios/login`;

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
      this._cachedRefreshToken = data.refresh_token ?? null;

      try {
        const baseUrl = this._cachedUrlLeal || '';
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
          const meUser = this.extractUserInternal(meData);
          this.updateIdentity(meUser);
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

  private extractUserInternal(data: LealApiEnvelope): LealUserInfo | undefined {
    const user = data.user;
    if (Array.isArray(user)) return user[0];
    if (user) return user;
    const nested = data.data;
    if (!nested) return undefined;
    if (Array.isArray(nested)) return nested[0];
    if ('user' in nested) return nested.user;
    return nested as LealUserInfo;
  }

  async refreshToken(): Promise<boolean> {
    if (!this._cachedRefreshToken || !this._cachedUrlLeal) return false;

    const url = `${this._cachedUrlLeal.replace(/\/$/, '')}/com_usuarios/refresh`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this._cachedRefreshToken }),
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

  async executeWithAuth(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    isRetry: boolean = false,
  ): Promise<LealApiEnvelope> {
    await this.loadConfigAndCredentials();

    if (!this.cachedToken) {
      await this.login({});
    }

    const baseUrl = this._cachedUrlLeal || '';
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
}
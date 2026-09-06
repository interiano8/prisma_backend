import { Injectable } from '@nestjs/common';
import {
  LoginRequest,
  LoginResponse,
} from '../../../domain/ports/in/auth-use-case.interface';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';
import type { PasswordHasherPort } from '../../../domain/ports/out/password-hasher.interface';
import type { TokenPort } from '../../../domain/ports/out/token.interface';
import type { ShiftInfo } from '../../../domain/entities/shift.entity';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../domain/errors/domain-error';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(dto: LoginRequest): Promise<LoginResponse> {
    const user = await this.authRepository.findUserByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedDomainError('Usuario o contraseña incorrectos');
    }
    if (!user.isActive) {
      throw new UnauthorizedDomainError('El usuario se encuentra inactivo');
    }
    const isPasswordValid = this.passwordHasher.verify(
      user.passwordHash ?? '',
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedDomainError('Usuario o contraseña incorrectos');
    }
    const storeConfig = await this.authRepository.findStoreByStoreId(
      dto.storeId,
    );
    if (!storeConfig) {
      throw new NotFoundDomainError('Configuración de tienda no encontrada');
    }
    storeConfig.posNumber = dto.posNo;
    const posConfig = await this.authRepository.findPosConfig(dto.posNo);
    storeConfig.mostrarBombas = posConfig?.mostrarBombas ?? false;
    storeConfig.ocultarBotonOtrasBombas =
      posConfig?.ocultarBotonOtrasBombas ?? false;
    storeConfig.numTransaccionesBombas =
      posConfig?.numTransaccionesBombas ?? 20;
    storeConfig.minutosAtrasada = posConfig?.minutosAtrasada ?? 10;
    storeConfig.mostrarTeclado = posConfig?.mostrarTeclado ?? true;
    storeConfig.declararMontosIniciales =
      posConfig?.declararMontosIniciales ?? false;
    // Cargar la configuración de impresora guardada (config JSON) para que
    // la impresión (preview/IP/nombre) funcione en todo el POS tras el login.
    const tpvConfig = await this.authRepository.findTpvConfig(dto.posNo);
    storeConfig.printerConfig = (tpvConfig as any) ?? undefined;
    // Zona horaria del servidor para que el cliente formatee las fechas
    // de cierre de turno y transacción en la misma zona.
    storeConfig.serverTimezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    const shiftInfo = await this.authRepository.getActiveShift(
      dto.storeId,
      dto.posNo,
      user.username,
    );
    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        profile: user.profile || 'CAJERO',
        isActive: true,
        pinLeal: user.pinLeal || '',
        preferencias: user.preferencias ?? null,
      },
      token: this.tokenService.sign({
        sub: user.id,
        username: user.username,
        profile: user.profile || 'CAJERO',
      }),
      storeConfig,
      shiftInfo: (shiftInfo || {
        Message: 'No open shift found',
        Shift: null,
      }) as ShiftInfo,
    };
  }
}

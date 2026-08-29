import { Injectable } from '@nestjs/common';
import {
  LoginRfidRequest,
  LoginResponse,
} from '../../../domain/ports/in/auth-use-case.interface';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';
import type { TokenPort } from '../../../domain/ports/out/token.interface';
import type { ShiftInfo } from '../../../domain/entities/shift.entity';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../domain/errors/domain-error';

@Injectable()
export class LoginRfidUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenPort,
  ) {}

  async execute(dto: LoginRfidRequest): Promise<LoginResponse> {
    const user = await this.authRepository.findUserByRfid(dto.rfidCode);
    if (!user) {
      throw new UnauthorizedDomainError(
        'Tarjeta RFID no registrada o inválida',
      );
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

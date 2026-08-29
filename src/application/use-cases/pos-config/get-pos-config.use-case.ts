import { Injectable } from '@nestjs/common';
import type { PosConfigRepository } from '../../../domain/ports/out/pos-config-repository.interface';

export interface PosConfigData {
  mostrarBombas: boolean;
  ocultarBotonOtrasBombas: boolean;
  numTransaccionesBombas: number;
  minutosAtrasada: number;
  mostrarTeclado: boolean;
  declararMontosIniciales: boolean;
}

@Injectable()
export class GetPosConfigUseCase {
  constructor(private readonly posConfigRepository: PosConfigRepository) {}

  async execute(posNo: string): Promise<PosConfigData> {
    const row = await this.posConfigRepository.findByPos(posNo);
    return {
      mostrarBombas: row?.mostrarBombas === true,
      ocultarBotonOtrasBombas: row?.ocultarBotonOtrasBombas === true,
      numTransaccionesBombas: row?.numTransaccionesBombas ?? 20,
      minutosAtrasada: row?.minutosAtrasada ?? 10,
      mostrarTeclado: row?.mostrarTeclado !== false,
      declararMontosIniciales: row?.declararMontosIniciales === true,
    };
  }
}

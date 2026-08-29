import { Injectable } from '@nestjs/common';
import type {
  PosConfigRepository,
  PosConfigUpdateData,
} from '../../../domain/ports/out/pos-config-repository.interface';
import { GetPosConfigUseCase, PosConfigData } from './get-pos-config.use-case';

@Injectable()
export class UpdatePosConfigUseCase {
  constructor(
    private readonly posConfigRepository: PosConfigRepository,
    private readonly getPosConfigUseCase: GetPosConfigUseCase,
  ) {}

  async execute(
    posNo: string,
    partial: {
      mostrarBombas?: boolean;
      numTransaccionesBombas?: number;
      minutosAtrasada?: number;
      mostrarTeclado?: boolean;
      declararMontosIniciales?: boolean;
    },
  ): Promise<PosConfigData> {
    const data: PosConfigUpdateData = {};
    if (partial.mostrarBombas !== undefined)
      data.mostrarBombas = partial.mostrarBombas;
    if (partial.numTransaccionesBombas !== undefined) {
      data.numTransaccionesBombas = partial.numTransaccionesBombas;
    }
    if (partial.minutosAtrasada !== undefined) {
      data.minutosAtrasada = partial.minutosAtrasada;
    }
    if (partial.mostrarTeclado !== undefined) {
      data.mostrarTeclado = partial.mostrarTeclado;
    }
    if (partial.declararMontosIniciales !== undefined) {
      data.declararMontosIniciales = partial.declararMontosIniciales;
    }

    await this.posConfigRepository.upsert(posNo, data);

    return this.getPosConfigUseCase.execute(posNo);
  }
}

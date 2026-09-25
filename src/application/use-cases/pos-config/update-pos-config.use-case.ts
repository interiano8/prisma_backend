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
      visualizacion?: string;
      caras?: number[];
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
    if (partial.visualizacion !== undefined) {
      data.visualizacion =
        partial.visualizacion === 'categorias' ? 'categorias' : 'multimedia';
    }
    if (partial.caras !== undefined) {
      data.caras = partial.caras
        .map((c) => Number(c))
        .filter((n) => Number.isFinite(n));
    }

    await this.posConfigRepository.upsert(posNo, data);

    return this.getPosConfigUseCase.execute(posNo);
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PosConfigRepository,
  PosConfigUpdateData,
  PosConfig,
} from '../../../domain/ports/out/pos-config-repository.interface';

@Injectable()
export class PosConfigRepositoryImpl implements PosConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPos(posNo: string): Promise<PosConfig | null> {
    const row = await this.prisma.configuracionPos.findUnique({
      where: { codigoPos: posNo },
    });
    if (!row) return null;
    return {
      mostrarBombas: row.mostrarBombas,
      ocultarBotonOtrasBombas: row.ocultarBotonOtrasBombas,
      numTransaccionesBombas: row.numTransaccionesBombas,
      minutosAtrasada: row.minutosAtrasada,
      mostrarTeclado: row.mostrarTeclado,
      declararMontosIniciales: row.declararMontosIniciales,
      visualizacion: row.visualizacion ?? null,
      config: row.config ?? undefined,
      caras: Array.isArray(row.caras)
        ? (row.caras as unknown[])
            .map((c) => Number(c))
            .filter((n) => Number.isFinite(n))
        : null,
    };
  }

  async upsert(posNo: string, data: PosConfigUpdateData): Promise<void> {
    await this.prisma.configuracionPos.upsert({
      where: { codigoPos: posNo },
      update: data as Prisma.ConfiguracionPosUpdateInput,
      create: {
        codigoPos: posNo,
        ...data,
      } as Prisma.ConfiguracionPosCreateInput,
    });
  }
}

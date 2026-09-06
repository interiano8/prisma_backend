import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ProgramacionMediaRepository,
  MediaProgramacionRow,
  MediaProgramacionWrite,
} from '../../../domain/ports/out/media-programacion-repository.interface';

@Injectable()
export class MediaProgramacionRepositoryImpl
  implements ProgramacionMediaRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async getMediaDir(): Promise<string> {
    const store = await this.prisma.tienda.findFirst({
      select: { carpetaMultimedia: true },
    });
    const dir = (store?.carpetaMultimedia || '').trim();
    if (!dir) {
      throw new Error('Carpeta multimedia no configurada');
    }
    return dir;
  }

  async list(): Promise<MediaProgramacionRow[]> {
    return this.prisma.mediaProgramacion.findMany({
      orderBy: { id: 'asc' },
    }) as Promise<MediaProgramacionRow[]>;
  }

  async create(data: MediaProgramacionWrite): Promise<MediaProgramacionRow> {
    return this.prisma.mediaProgramacion.create({
      data: {
        archivo: data.archivo || '',
        tipo: data.tipo ?? null,
        fechaInicio: data.fechaInicio ?? null,
        fechaFin: data.fechaFin ?? null,
        habilitado: data.habilitado !== false,
      },
    }) as Promise<MediaProgramacionRow>;
  }

  async update(
    id: number,
    data: MediaProgramacionWrite,
  ): Promise<MediaProgramacionRow> {
    return this.prisma.mediaProgramacion.update({
      where: { id },
      data: {
        ...(data.archivo !== undefined ? { archivo: data.archivo } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
        ...(data.fechaInicio !== undefined
          ? { fechaInicio: data.fechaInicio }
          : {}),
        ...(data.fechaFin !== undefined ? { fechaFin: data.fechaFin } : {}),
        ...(data.habilitado !== undefined
          ? { habilitado: data.habilitado }
          : {}),
      },
    }) as Promise<MediaProgramacionRow>;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.mediaProgramacion.delete({ where: { id } });
  }
}
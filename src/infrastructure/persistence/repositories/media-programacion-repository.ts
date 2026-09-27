import { Injectable } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
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
  private inMemoryItems: MediaProgramacionRow[] = [];
  private nextId = 1;

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
    if (this.inMemoryItems.length > 0) {
      return [...this.inMemoryItems];
    }
    try {
      const dir = await this.getMediaDir();
      if (!existsSync(dir)) return [];
      const files = readdirSync(dir);
      return files.map((archivo, idx) => ({
        id: idx + 1,
        archivo,
        tipo: null,
        fechaInicio: null,
        fechaFin: null,
        habilitado: true,
      }));
    } catch {
      return [];
    }
  }

  async create(data: MediaProgramacionWrite): Promise<MediaProgramacionRow> {
    const item: MediaProgramacionRow = {
      id: this.nextId++,
      archivo: data.archivo || '',
      tipo: data.tipo ?? null,
      fechaInicio: data.fechaInicio ?? null,
      fechaFin: data.fechaFin ?? null,
      habilitado: data.habilitado !== false,
    };
    this.inMemoryItems.push(item);
    return item;
  }

  async update(
    id: number,
    data: MediaProgramacionWrite,
  ): Promise<MediaProgramacionRow> {
    const idx = this.inMemoryItems.findIndex((it) => it.id === id);
    if (idx >= 0) {
      this.inMemoryItems[idx] = {
        ...this.inMemoryItems[idx],
        ...(data.archivo !== undefined ? { archivo: data.archivo } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
        ...(data.fechaInicio !== undefined
          ? { fechaInicio: data.fechaInicio }
          : {}),
        ...(data.fechaFin !== undefined ? { fechaFin: data.fechaFin } : {}),
        ...(data.habilitado !== undefined
          ? { habilitado: data.habilitado }
          : {}),
      };
      return this.inMemoryItems[idx];
    }
    return {
      id,
      archivo: data.archivo || '',
      tipo: data.tipo ?? null,
      fechaInicio: data.fechaInicio ?? null,
      fechaFin: data.fechaFin ?? null,
      habilitado: data.habilitado !== false,
    };
  }

  async delete(id: number): Promise<void> {
    this.inMemoryItems = this.inMemoryItems.filter((it) => it.id !== id);
  }
}
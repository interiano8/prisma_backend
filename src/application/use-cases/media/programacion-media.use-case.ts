import { Inject, Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve, basename, extname } from 'path';
import type {
  ProgramacionMediaRepository,
  MediaProgramacionWrite,
} from '../../../domain/ports/out/media-programacion-repository.interface';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

@Injectable()
export class ProgramacionMediaUseCase {
  constructor(
    @Inject('ProgramacionMediaRepository')
    private readonly repo: ProgramacionMediaRepository,
  ) {}

  async getMediaDir(): Promise<string> {
    return this.repo.getMediaDir();
  }

  async list() {
    const dir = await this.repo.getMediaDir();
    if (!existsSync(dir)) {
      throw new Error('La carpeta multimedia no existe');
    }
    const rows = await this.repo.list();
    return rows
      .filter((r) => existsSync(resolve(dir, basename(r.archivo))))
      .map((r) => {
        const ext = extname(r.archivo).toLowerCase();
        const isImage = IMAGE_EXT.includes(ext);
        return {
          name: r.archivo,
          type: isImage ? 'image' : 'video',
          url: `/api/media/file/${encodeURIComponent(r.archivo)}`,
        };
      });
  }

  listProgramacion() {
    return this.repo.list();
  }

  create(body: any) {
    return this.repo.create(this.map(body));
  }

  update(id: string, body: any) {
    return this.repo.update(Number(id), this.map(body));
  }

  delete(id: string) {
    return this.repo.delete(Number(id));
  }

  private map(body: any): MediaProgramacionWrite {
    return {
      archivo: body?.archivo,
      tipo: body?.tipo ?? null,
      fechaInicio: body?.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaFin: body?.fechaFin ? new Date(body.fechaFin) : null,
      habilitado: body?.habilitado !== false,
    };
  }
}
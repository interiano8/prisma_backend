import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readdirSync, statSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { PrismaService } from '../../../prisma/prisma.service';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

@Controller('media')
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  private async getMediaDir(): Promise<string> {
    const store = await this.prisma.tienda.findFirst({
      select: { carpetaMultimedia: true },
    });
    const dir = (store?.carpetaMultimedia || '').trim();
    if (!dir) {
      throw new NotFoundException('Carpeta multimedia no configurada');
    }
    if (!existsSync(dir)) {
      throw new NotFoundException('La carpeta multimedia no existe');
    }
    return dir;
  }

  @Get('list')
  async list() {
    const dir = await this.getMediaDir();
    const files = readdirSync(dir)
      .filter((f) => {
        const ext = extname(f).toLowerCase();
        return IMAGE_EXT.includes(ext) || VIDEO_EXT.includes(ext);
      })
      .sort();
    return files.map((f) => {
      const ext = extname(f).toLowerCase();
      const isImage = IMAGE_EXT.includes(ext);
      return {
        name: f,
        type: isImage ? 'image' : 'video',
        url: `/api/media/file/${encodeURIComponent(f)}`,
      };
    });
  }

  @Get('file/:name')
  async file(@Param('name') name: string, @Res() res: Response) {
    if (
      !name ||
      name.includes('..') ||
      name.includes('/') ||
      name.includes('\\')
    ) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const dir = await this.getMediaDir();
    const filePath = resolve(dir, basename(name));
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new NotFoundException('Archivo no encontrado');
    }
    res.sendFile(filePath);
  }
}

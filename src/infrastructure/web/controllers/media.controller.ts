import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, statSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { ProgramacionMediaUseCase } from '../../../application/use-cases/media/programacion-media.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

@Controller('media')
export class MediaController {
  constructor(private readonly mediaUseCase: ProgramacionMediaUseCase) {}

  @Get('list')
  async list() {
    return this.mediaUseCase.list();
  }

  @Get('programacion')
  @UseGuards(JwtAuthGuard, AdminGuard)
  listProgramacion() {
    return this.mediaUseCase.listProgramacion();
  }

  @Post('programacion')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() body: any) {
    if (!String(body?.archivo || '').trim()) {
      throw new BadRequestException('archivo requerido');
    }
    return this.mediaUseCase.create(body);
  }

  @Put('programacion/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.mediaUseCase.update(id, body);
  }

  @Delete('programacion/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    await this.mediaUseCase.delete(id);
    return { success: true };
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
    const dir = await this.mediaUseCase.getMediaDir();
    const filePath = resolve(dir, basename(name));
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const ext = extname(filePath).toLowerCase();
    const cache =
      VIDEO_EXT.includes(ext)
        ? 'public, max-age=2592000, immutable'
        : 'public, max-age=86400';
    res.setHeader('Cache-Control', cache);
    res.sendFile(filePath);
  }
}
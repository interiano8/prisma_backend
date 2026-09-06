import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { SeriesRepository } from '../../../domain/ports/out/series-repository.interface';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

const CAI_RE = /^\d{3}-\d{3}-\d{2}-\d{8}$/;
const INTERNAL_RE = /^00\d{3}[A-Z]{1,2}\d+$/;
const CAI_SERIES = new Set(['FV-HN', 'NC-HN']);
const INTERNAL_SERIES = new Set(['TR-ID', 'TK-HN', 'EXT-RET']);

@Controller('series')
export class SeriesController {
  constructor(
    @Inject('SeriesRepository')
    private readonly seriesRepo: SeriesRepository,
  ) {}

  @Get()
  list(@Query('storeId') storeId?: string, @Query('posNo') posNo?: string) {
    return this.seriesRepo.list(storeId, posNo);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() body: any) {
    this.validateSerie(body.codigoSerie, body.numeroInicio, body.numeroFin);
    return this.seriesRepo.create({
      codigoSerie: body.codigoSerie,
      idTienda: body.idTienda,
      codigoPos: body.codigoPos,
      fechaInicio: body.fechaInicio ?? null,
      numeroInicio: body.numeroInicio,
      numeroFin: body.numeroFin,
      numeroAviso: body.numeroAviso ?? null,
      incremento: body.incremento ?? 1,
      cai: body.cai ?? null,
      rangoDesde: body.rangoDesde ?? null,
      rangoHasta: body.rangoHasta ?? null,
      fechaVenceRango: body.fechaVenceRango ?? null,
    });
  }

  @Put('editing/:nl/:serie')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async setEditing(
    @Param('nl') nl: string,
    @Param('serie') serie: string,
    @Body() body: { editing: boolean },
  ) {
    return this.seriesRepo.setEditing(
      this.parseId(nl),
      serie,
      !!body.editing,
    );
  }

  @Put(':nl/:serie')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('nl') nl: string,
    @Param('serie') serie: string,
    @Body() body: any,
  ) {
    if (body.numeroInicio || body.numeroFin) {
      this.validateSerie(
        serie,
        body.numeroInicio,
        body.numeroFin,
      );
    }
    return this.seriesRepo.update(this.parseId(nl), serie, body);
  }

  @Delete(':nl/:serie')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async close(@Param('nl') nl: string, @Param('serie') serie: string) {
    return this.seriesRepo.close(this.parseId(nl), serie);
  }

  private parseId(raw: string): number {
    const id = Number(raw);
    if (isNaN(id)) throw new BadRequestException(`numeroLinea inválido: ${raw}`);
    return id;
  }

  private validateSerie(serie: string, inicio?: string, fin?: string) {
    if (!serie) throw new BadRequestException('codigoSerie requerido');
    if (CAI_SERIES.has(serie)) {
      if (inicio && !CAI_RE.test(inicio))
        throw new BadRequestException(`Formato CAI inválido: ${inicio}`);
      if (fin && !CAI_RE.test(fin))
        throw new BadRequestException(`Formato CAI inválido: ${fin}`);
    } else if (INTERNAL_SERIES.has(serie)) {
      if (inicio && !INTERNAL_RE.test(inicio))
        throw new BadRequestException(`Formato interno inválido: ${inicio}`);
      if (fin && !INTERNAL_RE.test(fin))
        throw new BadRequestException(`Formato interno inválido: ${fin}`);
    }
  }
}
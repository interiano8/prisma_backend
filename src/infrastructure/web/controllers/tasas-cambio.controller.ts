import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TasaCambioUseCase } from '../../../application/use-cases/tasas-cambio/tasa-cambio.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

@Controller('tasas-cambio')
export class TasasCambioController {
  constructor(private readonly useCase: TasaCambioUseCase) {}

  @Get('latest')
  latest() {
    return this.useCase.latest();
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  list() {
    return this.useCase.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() body: { tasa?: number; fecha?: string }) {
    const tasa = Number(body?.tasa);
    if (isNaN(tasa) || tasa <= 0) {
      throw new BadRequestException('tasa requerida y mayor a 0');
    }
    return this.useCase.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() body: any) {
    if (body?.tasa != null && (isNaN(Number(body.tasa)) || Number(body.tasa) <= 0)) {
      throw new BadRequestException('tasa inválida');
    }
    return this.useCase.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    await this.useCase.delete(id);
    return { success: true };
  }
}
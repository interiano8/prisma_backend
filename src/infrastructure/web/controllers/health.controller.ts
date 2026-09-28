import { Controller, Get, Post, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthCheckResult, HealthService } from './health.service';

@ApiTags('Salud y Observabilidad')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Verifica el estado del sistema, base de datos, bombas y licencias',
  })
  @ApiResponse({
    status: 200,
    description: 'Sistema completamente operativo (ok) o degradado (degraded)',
  })
  @ApiResponse({
    status: 503,
    description: 'Sistema fuera de servicio o base de datos inaccesible (error)',
  })
  async getHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthCheckResult> {
    const result = await this.healthService.checkHealth();
    if (result.status === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    } else {
      res.status(HttpStatus.OK);
    }
    return result;
  }

  @Post('sync-now')
  @ApiOperation({
    summary: 'Fuerza la sincronización inmediata de ventas y descarga de maestros desde el Hub',
  })
  @ApiResponse({
    status: 200,
    description: 'Sincronización forzada completada',
  })
  async syncNow() {
    return this.healthService.syncNow();
  }
}

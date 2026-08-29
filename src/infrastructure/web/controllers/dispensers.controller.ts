import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { DispensersService } from '../../../application/services/dispensers.service';
import { AuthorizePumpDto } from '../dto/dispenser/authorize-pump.dto';

@Controller('dispensers')
export class DispensersController {
  constructor(private readonly dispensersService: DispensersService) {}

  @Get('status')
  async getStatus() {
    return this.dispensersService.getDispensers();
  }

  @Get('hoses')
  async getHoses() {
    return this.dispensersService.getHoses();
  }

  @Get('transactions/:pumpId')
  async getTransactions(
    @Param('pumpId', ParseIntPipe) pumpId: number,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : undefined;
    return this.dispensersService.getPumpTransactions(pumpId, lim);
  }

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  authorize(@Body() dto: AuthorizePumpDto) {
    return this.dispensersService.authorizePump(dto);
  }
}

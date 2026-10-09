import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ParkedSalesService } from '../../../application/services/parked-sales.service';
import { CreateParkedSaleDto } from '../dto/parked-sale/create-parked-sale.dto';

@Controller('parked-sales')
export class ParkedSalesController {
  constructor(private readonly service: ParkedSalesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() dto: CreateParkedSaleDto) {
    return this.service.parkSale({
      storeId: dto.storeId,
      posNo: dto.posNo,
      usuario: dto.usuario,
      turnoId: dto.turnoId,
      cliente: dto.cliente,
      items: dto.items,
      nota: dto.nota,
      total: dto.total,
    });
  }

  @Get()
  async listActive(@Query('storeId') storeId: string) {
    if (!storeId) {
      return [];
    }
    return this.service.listActive(storeId);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resume(@Param('id') id: string) {
    return this.service.resumeSale(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async discard(@Param('id') id: string) {
    return this.service.discardSale(id);
  }
}

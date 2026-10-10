import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  TransfersService,
  CreateStoreTransferRequestDto,
} from '../../../application/services/transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('request')
  async requestTransfer(@Body() dto: CreateStoreTransferRequestDto) {
    return this.transfersService.requestTransfer(dto);
  }

  @Get('my-store')
  async getMyStoreTransfers() {
    return this.transfersService.getMyStoreTransfers();
  }
}

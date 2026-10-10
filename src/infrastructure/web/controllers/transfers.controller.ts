import { Controller, Get, Post, Body } from '@nestjs/common';
import { TransfersService } from '../../../application/services/transfers.service';
import { CreateStoreTransferRequestDto } from '../dto/transfer/create-store-transfer-request.dto';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('request')
  async requestTransfer(@Body() dto: any) {
    return this.transfersService.requestTransfer(dto);
  }

  @Get('my-store')
  async getMyStoreTransfers() {
    return this.transfersService.getMyStoreTransfers();
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { InventoryService } from '../../../application/services/inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':productCode/check')
  async checkProductStock(@Param('productCode') productCode: string) {
    return this.inventoryService.checkProductStock(productCode);
  }

  @Get(':productCode/network')
  async getNetworkStock(@Param('productCode') productCode: string) {
    return this.inventoryService.getNetworkStock(productCode);
  }
}

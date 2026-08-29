import { Body, Controller, Param, Put } from '@nestjs/common';
import { UpdateStoreConfigUseCase } from '../../../application/use-cases/store-config/update-store-config.use-case';

@Controller('store-config')
export class StoreConfigController {
  constructor(
    private readonly updateStoreConfigUseCase: UpdateStoreConfigUseCase,
  ) {}

  @Put(':storeId')
  async update(
    @Param('storeId') storeId: string,
    @Body() body: { moneda?: string; carpetaMultimedia?: string },
  ) {
    return this.updateStoreConfigUseCase.execute(storeId, body);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ShiftService } from '../../../application/services/shift.service';
import { OpenShiftDto } from '../dto/shift/open-shift.dto';
import { CloseShiftDto } from '../dto/shift/close-shift.dto';
import { GetShiftStatusUseCase } from '../../../application/use-cases/shift/get-shift-status.use-case';
import { OpenShiftUseCase } from '../../../application/use-cases/shift/open-shift.use-case';
import { CloseShiftUseCase } from '../../../application/use-cases/shift/close-shift.use-case';

@Controller('shift')
export class ShiftController {
  constructor(
    private readonly shiftService: ShiftService,
    private readonly getShiftStatusUseCase: GetShiftStatusUseCase,
    private readonly openShiftUseCase: OpenShiftUseCase,
    private readonly closeShiftUseCase: CloseShiftUseCase,
  ) {}

  @Get('open')
  async getOpenShift(
    @Query('storeId') storeId: string,
    @Query('employeeName') employeeName: string,
    @Query('posNo') posNo?: string,
  ) {
    return this.getShiftStatusUseCase.execute(
      storeId,
      posNo || '',
      employeeName,
    );
  }

  @Post('open')
  @HttpCode(HttpStatus.OK)
  async openShift(@Body() dto: OpenShiftDto) {
    return this.openShiftUseCase.execute({
      storeId: dto.storeId,
      posNo: dto.posNo,
      employeeName: dto.employeeName,
      initialAmount: dto.initialAmount,
      shiftNumber: dto.shiftNumber,
    });
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  async closeShift(@Body() dto: CloseShiftDto) {
    await this.closeShiftUseCase.execute({
      storeId: dto.storeId,
      posNo: dto.posNo,
      employeeName: dto.employeeName,
      actualAmount: 0,
    });
    return { success: true };
  }

  @Post('fusion-close')
  async closeFusionShift(@Body() dto: CloseShiftDto) {
    return this.shiftService.closeFusionShift(dto);
  }

  @Get('sales-report')
  async getShiftSalesReport(
    @Query('storeId') storeId: string,
    @Query('posCode') posCode: string,
    @Query('employeeName') employeeName: string,
    @Query('turno') turno: string,
    @Query('fechaTurno') fechaTurno: string,
  ) {
    return this.shiftService.getShiftSalesReport(
      storeId,
      posCode,
      employeeName,
      turno,
      fechaTurno,
    );
  }

  @Get('available')
  async getAvailableShifts(
    @Query('storeId') storeId: string,
    @Query('posCode') posCode: string,
    @Query('fechaTurno') fechaTurno: string,
  ) {
    return this.shiftService.getAvailableShifts(storeId, posCode, fechaTurno);
  }

  @Get(':id/reclassifications')
  async getShiftReclassifications(@Param('id') shiftId: string) {
    return this.shiftService.getShiftReclassifications(shiftId);
  }
}

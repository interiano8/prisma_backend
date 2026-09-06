import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Prisma } from '../../../../src/generated/prisma/client';
import { PrinterService } from '../../printing/printer.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('print')
  async printReceipt(
    @Body() body: { printerPath: string; bytesBase64: string },
  ) {
    if (!body.printerPath || !body.bytesBase64) {
      throw new HttpException(
        'printerPath and bytesBase64 are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.printerService.printRaw(body.printerPath, body.bytesBase64);
      return { success: true, message: 'Printed successfully' };
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : (JSON.stringify(error) ?? 'unknown error');
      throw new HttpException(
        `Printing failed: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async saveConfig(
    @Body() body: { posNo: string; printerConfig?: Prisma.InputJsonValue },
  ) {
    if (!body.posNo || !body.printerConfig) {
      throw new HttpException(
        'posNo and printerConfig are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.printerService.savePrinterConfig(
        body.posNo,
        body.printerConfig,
      );
      return { success: true, message: 'Printer config saved successfully' };
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : (JSON.stringify(error) ?? 'unknown error');
      throw new HttpException(
        `Saving config failed: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getConfig(@Query('posNo') posNo?: string) {
    if (!posNo) {
      throw new HttpException('posNo is required', HttpStatus.BAD_REQUEST);
    }
    const config = await this.printerService.getPrinterConfig(posNo);
    return { posNo, printerConfig: config ?? null };
  }
}

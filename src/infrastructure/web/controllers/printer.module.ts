import { Module } from '@nestjs/common';
import { PrinterController } from './printer.controller';
import { PrinterService } from '../../printing/printer.service';
import { PosConfigModule } from './pos-config.module';

@Module({
  imports: [PosConfigModule],
  controllers: [PrinterController],
  providers: [PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}

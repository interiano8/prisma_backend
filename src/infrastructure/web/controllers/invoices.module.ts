import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from '../../../application/services/invoices.service';
import { SorteosService } from '../../../application/services/sorteos.service';
import { InvoiceLealProcessor } from '../../../application/services/invoice-leal.processor';
import { DispensersModule } from './dispensers.module';
import { LealModule } from './leal.module';
import { InvoiceRepositoryImpl } from '../../persistence/repositories/invoice-repository';
import { DispenserRepositoryImpl } from '../../persistence/repositories/dispenser-repository';
import { StoreConfigRepositoryImpl } from '../../persistence/repositories/store-config-repository';
import { SorteosRepositoryImpl } from '../../persistence/repositories/sorteos-repository';

@Module({
  imports: [DispensersModule, LealModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    SorteosService,
    InvoiceLealProcessor,
    { provide: 'InvoiceRepository', useClass: InvoiceRepositoryImpl },
    { provide: 'DispenserRepository', useClass: DispenserRepositoryImpl },
    { provide: 'StoreConfigRepository', useClass: StoreConfigRepositoryImpl },
    { provide: 'SorteosRepository', useClass: SorteosRepositoryImpl },
  ],
  exports: [SorteosService, 'InvoiceRepository'],
})
export class InvoicesModule {}

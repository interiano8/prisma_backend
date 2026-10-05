import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { CampanasController } from './campanas.controller';
import { SeriesController } from './series.controller';
import { AuthModule } from './auth.module';
import { SeriesRepositoryImpl } from '../../persistence/repositories/series-repository';
import { InvoicesService } from '../../../application/services/invoices.service';
import { CampanasService } from '../../../application/services/campanas.service';
import { InvoiceLealProcessor } from '../../../application/services/invoice-leal.processor';
import { DispensersModule } from './dispensers.module';
import { LealModule } from './leal.module';
import { InvoiceRepositoryImpl } from '../../persistence/repositories/invoice-repository';
import { InvoiceQueryRepositoryImpl } from '../../persistence/repositories/invoice-query-repository';
import { DispenserRepositoryImpl } from '../../persistence/repositories/dispenser-repository';
import { StoreConfigRepositoryImpl } from '../../persistence/repositories/store-config-repository';
import { CampanasRepositoryImpl } from '../../persistence/repositories/campanas-repository';
import { DiscountService } from '../../../domain/services/discount.service';

import { CustomersModule } from './customers.module';

@Module({
  imports: [DispensersModule, LealModule, AuthModule, CustomersModule],
  controllers: [InvoicesController, CampanasController, SeriesController],
  providers: [
    InvoicesService,
    CampanasService,
    InvoiceLealProcessor,
    { provide: DiscountService, useValue: new DiscountService() },
    { provide: 'InvoiceRepository', useClass: InvoiceRepositoryImpl },
    { provide: 'InvoiceQueryRepository', useClass: InvoiceQueryRepositoryImpl },
    { provide: 'DispenserRepository', useClass: DispenserRepositoryImpl },
    { provide: 'StoreConfigRepository', useClass: StoreConfigRepositoryImpl },
    { provide: 'CampanasRepository', useClass: CampanasRepositoryImpl },
    { provide: 'SeriesRepository', useClass: SeriesRepositoryImpl },
  ],
  exports: [CampanasService, 'InvoiceRepository', 'InvoiceQueryRepository'],
})
export class InvoicesModule {}

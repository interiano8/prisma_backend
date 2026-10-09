import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ParkedSalesController } from './parked-sales.controller';
import { ParkedSalesService } from '../../../application/services/parked-sales.service';
import { ParkedSalesRepositoryImpl } from '../../persistence/repositories/parked-sales-repository';

@Module({
  imports: [PrismaModule],
  controllers: [ParkedSalesController],
  providers: [
    ParkedSalesService,
    {
      provide: 'ParkedSalesRepository',
      useClass: ParkedSalesRepositoryImpl,
    },
  ],
  exports: [ParkedSalesService, 'ParkedSalesRepository'],
})
export class ParkedSalesModule {}

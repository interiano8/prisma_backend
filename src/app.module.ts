import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './infrastructure/web/controllers/auth.module';
import { ProductsModule } from './infrastructure/web/controllers/products.module';
import { CustomersModule } from './infrastructure/web/controllers/customers.module';
import { ShiftModule } from './infrastructure/web/controllers/shift.module';
import { InvoicesModule } from './infrastructure/web/controllers/invoices.module';
import { DispensersModule } from './infrastructure/web/controllers/dispensers.module';
import { PaymentModule } from './infrastructure/web/controllers/payment.module';
import { LealModule } from './infrastructure/web/controllers/leal.module';
import { PrinterModule } from './infrastructure/web/controllers/printer.module';
import { PosConfigModule } from './infrastructure/web/controllers/pos-config.module';
import { StoreConfigModule } from './infrastructure/web/controllers/store-config.module';
import { MediaModule } from './infrastructure/web/controllers/media.module';
import { HealthModule } from './infrastructure/web/controllers/health.module';
import { ParkedSalesModule } from './infrastructure/web/controllers/parked-sales.module';
import { InventoryModule } from './infrastructure/web/controllers/inventory.module';
import { TransfersModule } from './infrastructure/web/controllers/transfers.module';
import { RequestLoggerMiddleware } from './infrastructure/web/middleware/request-logger.middleware';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
    AuthModule,
    ProductsModule,
    CustomersModule,
    ShiftModule,
    InvoicesModule,
    DispensersModule,
    PaymentModule,
    LealModule,
    PrinterModule,
    PosConfigModule,
    StoreConfigModule,
    MediaModule,
    HealthModule,
    ParkedSalesModule,
    InventoryModule,
    TransfersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('{*path}');
  }
}

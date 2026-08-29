import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductRepositoryImpl } from '../../persistence/repositories/product-repository';
import { ListProductsUseCase } from '../../../application/use-cases/product/list-products.use-case';
import { GetProductUseCase } from '../../../application/use-cases/product/get-product.use-case';
import { GetProductDiscountUseCase } from '../../../application/use-cases/product/get-product-discount.use-case';
import { GetProductByBarcodeUseCase } from '../../../application/use-cases/product/get-product-by-barcode.use-case';
import { CalculateCartDiscountsUseCase } from '../../../application/use-cases/product/calculate-cart-discounts.use-case';
import { DiscountService } from '../../../domain/services/discount.service';
import type { ProductRepository } from '../../../domain/ports/out/product-repository.interface';

@Module({
  controllers: [ProductsController],
  providers: [
    { provide: DiscountService, useValue: new DiscountService() },
    { provide: 'ProductRepository', useClass: ProductRepositoryImpl },
    {
      provide: ListProductsUseCase,
      useFactory: (repo: ProductRepository) => new ListProductsUseCase(repo),
      inject: ['ProductRepository'],
    },
    {
      provide: GetProductUseCase,
      useFactory: (repo: ProductRepository) => new GetProductUseCase(repo),
      inject: ['ProductRepository'],
    },
    {
      provide: GetProductByBarcodeUseCase,
      useFactory: (repo: ProductRepository) =>
        new GetProductByBarcodeUseCase(repo),
      inject: ['ProductRepository'],
    },
    {
      provide: GetProductDiscountUseCase,
      useFactory: (discountService: DiscountService, repo: ProductRepository) =>
        new GetProductDiscountUseCase(repo, discountService),
      inject: [DiscountService, 'ProductRepository'],
    },
    {
      provide: CalculateCartDiscountsUseCase,
      useFactory: (repo: ProductRepository) =>
        new CalculateCartDiscountsUseCase(repo),
      inject: ['ProductRepository'],
    },
  ],
  exports: ['ProductRepository'],
})
export class ProductsModule {}

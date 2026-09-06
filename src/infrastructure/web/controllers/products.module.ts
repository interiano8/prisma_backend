import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductRepositoryImpl } from '../../persistence/repositories/product-repository';
import { ListProductsUseCase } from '../../../application/use-cases/product/list-products.use-case';
import { ListCategoriesUseCase } from '../../../application/use-cases/product/list-categories.use-case';
import { GetProductUseCase } from '../../../application/use-cases/product/get-product.use-case';
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
      provide: ListCategoriesUseCase,
      useFactory: (repo: ProductRepository) => new ListCategoriesUseCase(repo),
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
      provide: CalculateCartDiscountsUseCase,
      useFactory: (discountService: DiscountService, repo: ProductRepository) =>
        new CalculateCartDiscountsUseCase(repo, discountService),
      inject: [DiscountService, 'ProductRepository'],
    },
  ],
  exports: ['ProductRepository'],
})
export class ProductsModule {}

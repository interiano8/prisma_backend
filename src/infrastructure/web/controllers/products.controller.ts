import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { ListProductsUseCase } from '../../../application/use-cases/product/list-products.use-case';
import { ListCategoriesUseCase } from '../../../application/use-cases/product/list-categories.use-case';
import { GetProductUseCase } from '../../../application/use-cases/product/get-product.use-case';
import { GetProductByBarcodeUseCase } from '../../../application/use-cases/product/get-product-by-barcode.use-case';
import { CalculateCartDiscountsUseCase } from '../../../application/use-cases/product/calculate-cart-discounts.use-case';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly getProductByBarcodeUseCase: GetProductByBarcodeUseCase,
    private readonly calculateCartDiscountsUseCase: CalculateCartDiscountsUseCase,
  ) {}

  @Get()
  async getProducts(@Query('category') category?: string) {
    return this.listProductsUseCase.execute(category);
  }

  @Get('categories')
  async getCategories() {
    return this.listCategoriesUseCase.execute();
  }

  @Get('barcode/:code')
  async getProductByBarcode(@Param('code') code: string) {
    return this.getProductByBarcodeUseCase.execute(code);
  }

  @Get(':code')
  async getProductByCode(@Param('code') code: string) {
    return this.getProductUseCase.execute(code);
  }

  @Post('calculate-discounts')
  async calculateDiscounts(
    @Body()
    body: {
      customerCode: string;
      items: {
        code: string;
        quantity: number;
        vatGroup: string;
        unitPrice: number;
      }[];
    },
  ) {
    if (!body.customerCode || !body.items || body.items.length === 0)
      return body.items || [];
    return this.calculateCartDiscountsUseCase.execute(
      body.customerCode,
      body.items,
    );
  }
}

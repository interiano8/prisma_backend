import { Injectable } from '@nestjs/common';
import type { ProductRepository } from '../../../domain/ports/out/product-repository.interface';
import { Discount } from '../../../domain/entities/product.entity';
import { DiscountService } from '../../../domain/services/discount.service';

@Injectable()
export class GetProductDiscountUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly discountService: DiscountService,
  ) {}

  async execute(code: string, customerCode: string): Promise<Discount | null> {
    const discount = await this.productRepository.findDiscount(
      code,
      customerCode,
    );
    if (discount && this.discountService.isDiscountActive(discount)) {
      return discount;
    }
    return null;
  }
}

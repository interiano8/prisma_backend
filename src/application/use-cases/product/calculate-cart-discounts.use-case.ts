import { Injectable } from '@nestjs/common';
import type {
  ProductRepository,
  DiscountCalculation,
} from '../../../domain/ports/out/product-repository.interface';

export interface CartDiscountItem {
  code: string;
  quantity: number;
  vatGroup: string;
  unitPrice: number;
}

@Injectable()
export class CalculateCartDiscountsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(
    customerCode: string,
    items: CartDiscountItem[],
  ): Promise<DiscountCalculation[]> {
    const results = await Promise.all(
      items.map(async (item) => {
        const result = await this.productRepository.calculateDiscount(
          item.code,
          customerCode,
          item.quantity,
          item.vatGroup,
          item.unitPrice,
        );
        return (
          result ?? {
            code: item.code,
            hasDiscount: false,
            discountPercentage: 0,
            quantity: item.quantity,
            unitPriceWithIsv: item.unitPrice,
            unitPriceWithoutIsv: item.unitPrice,
            unitPriceWithDiscount: item.unitPrice,
            isvAmountUnit: 0,
            totalWithoutIsv: item.unitPrice * item.quantity,
            totalDiscount: 0,
            totalIsv: 0,
            finalTotal: item.unitPrice * item.quantity,
          }
        );
      }),
    );
    return results;
  }
}

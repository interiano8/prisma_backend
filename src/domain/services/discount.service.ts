import { Discount } from '../entities/product.entity';

export class DiscountService {
  calculateDiscountAmount(
    unitPrice: number,
    quantity: number,
    discount: Discount,
  ): number {
    if (discount.porcentaje > 0) {
      return (unitPrice * quantity * discount.porcentaje) / 100;
    }
    if (discount.amountPerGallon && discount.amountPerGallon > 0) {
      return discount.amountPerGallon * quantity;
    }
    if (discount.amountPerLiter && discount.amountPerLiter > 0) {
      return discount.amountPerLiter * quantity;
    }
    return 0;
  }

  isDiscountActive(discount: Discount): boolean {
    if (discount.active === false) return false;
    const now = new Date();
    if (discount.startingDate && new Date(discount.startingDate) > now)
      return false;
    if (discount.endingDate && new Date(discount.endingDate) < now)
      return false;
    return true;
  }
}

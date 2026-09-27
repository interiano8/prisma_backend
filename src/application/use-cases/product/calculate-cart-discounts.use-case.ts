import { Injectable } from '@nestjs/common';
import type {
  ProductRepository,
  DiscountCalculation,
} from '../../../domain/ports/out/product-repository.interface';
import {
  DiscountService,
  computeLineTotals,
} from '../../../domain/services/discount.service';

export interface CartDiscountItem {
  code: string;
  quantity: number;
  vatGroup: string;
  unitPrice: number;
}

function isvRate(vatGroup: string): number {
  if (vatGroup.includes('15')) return 15;
  if (vatGroup.includes('18')) return 18;
  return 0;
}

@Injectable()
export class CalculateCartDiscountsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly discountService: DiscountService,
  ) {}

  async execute(
    customerCode: string,
    items: CartDiscountItem[],
  ): Promise<DiscountCalculation[]> {
    const results = await Promise.all(
      items.map(async (item) => {
        const rules = await this.productRepository.findApplicableDiscountRules(
          customerCode,
          item.code,
          '',
        );
        const winner = this.discountService.evaluateBestRule(
          rules,
          item.quantity,
          item.unitPrice,
          item.vatGroup,
        );
        if (!winner) {
          return {
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
          };
        }
        const vat = isvRate(item.vatGroup);
        const totals = computeLineTotals(
          item.unitPrice,
          item.quantity,
          vat,
          winner.benefit,
        );
        const percentage =
          winner.appliedRules && winner.appliedRules.length > 0
            ? winner.appliedRules.reduce(
                (sum, ar) =>
                  sum + (ar.rule.tipoBeneficio === 'PORCENTAJE' ? ar.rule.valor : 0),
                0,
              )
            : (winner.rule.tipoBeneficio === 'PORCENTAJE' ? winner.rule.valor : 0);
        return {
          code: item.code,
          hasDiscount: winner.benefit > 0,
          discountPercentage: percentage,
          quantity: item.quantity,
          unitPriceWithIsv: item.unitPrice,
          unitPriceWithoutIsv: winner.baseGravada,
          unitPriceWithDiscount:
            totals.montoConIsv / (item.quantity || 1),
          isvAmountUnit: totals.montoIsv / (item.quantity || 1),
          totalWithoutIsv: totals.baseDescontada,
          totalDiscount: winner.benefit,
          totalIsv: totals.montoIsv,
          finalTotal: totals.montoConIsv,
        };
      }),
    );
    return results;
  }
}
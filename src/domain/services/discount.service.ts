import { DiscountRule } from '../entities/product.entity';

export interface BestRuleResult {
  rule: DiscountRule;
  benefit: number;
  baseGravada: number;
}

export interface LineTotals {
  baseGravadaTotal: number;
  descuento: number;
  baseDescontada: number;
  montoIsv: number;
  montoConIsv: number;
}

export function computeLineTotals(
  unitPriceWithIsv: number,
  quantity: number,
  vatPercent: number,
  discountTotal: number,
): LineTotals {
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const baseGravadaTotal = round2((unitPriceWithIsv * quantity) / (1 + vatPercent / 100));
  const descuento = round2(discountTotal || 0);
  const baseDescontada = round2(baseGravadaTotal - descuento);
  const montoIsv = round2(baseDescontada * (vatPercent / 100));
  const montoConIsv = round2(baseDescontada + montoIsv);
  return {
    baseGravadaTotal,
    descuento,
    baseDescontada,
    montoIsv,
    montoConIsv,
  };
}

export class DiscountService {
  private isvRate(vatGroup: string): number {
    if (vatGroup.includes('15')) return 15;
    if (vatGroup.includes('18')) return 18;
    return 0;
  }

  private benefit(
    rule: DiscountRule,
    baseGravadaTotal: number,
    quantity: number,
  ): number {
    switch (rule.tipoBeneficio) {
      case 'PORCENTAJE':
        return baseGravadaTotal * (rule.valor / 100);
      case 'MONTO_FIJO':
        return rule.valor * quantity;
      case 'MONTO_VOLUMEN':
        return rule.valor * quantity;
      default:
        return 0;
    }
  }

  evaluateBestRule(
    rules: DiscountRule[],
    quantity: number,
    unitPriceWithIsv: number,
    vatGroup: string,
  ): BestRuleResult | null {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const isv = this.isvRate(vatGroup);
    const baseGravadaTotal = round2(
      (unitPriceWithIsv * quantity) / (1 + isv / 100),
    );
    const baseGravada = round2(unitPriceWithIsv / (1 + isv / 100));
    const candidates = rules
      .filter((r) => r.cantidadMinima == null || quantity >= r.cantidadMinima)
      .map((r) => ({
        rule: r,
        benefit: round2(this.benefit(r, baseGravadaTotal, quantity)),
      }));
    if (candidates.length === 0) return null;
    const winner = candidates.sort((a, b) => {
      if (a.rule.prioridad !== b.rule.prioridad)
        return b.rule.prioridad - a.rule.prioridad;
      if (a.benefit !== b.benefit) return b.benefit - a.benefit;
      return a.rule.id < b.rule.id ? -1 : 1;
    })[0];
    return { rule: winner.rule, benefit: winner.benefit, baseGravada };
  }
}

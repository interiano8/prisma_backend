import { DiscountRule } from '../entities/product.entity';

export interface AppliedRuleItem {
  rule: DiscountRule;
  benefit: number;
}

export interface BestRuleResult {
  rule: DiscountRule;
  benefit: number;
  baseGravada: number;
  appliedRules?: AppliedRuleItem[];
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

    // 1. Filtrar reglas candidatas por cantidad mínima
    const candidates = rules
      .filter((r) => r.cantidadMinima == null || quantity >= r.cantidadMinima)
      .map((r) => ({
        rule: r,
        benefit: round2(this.benefit(r, baseGravadaTotal, quantity)),
      }));

    if (candidates.length === 0) return null;

    // 2. Separar reglas no acumulables (default: acumulable === false) y acumulables (acumulable === true)
    const nonStackable = candidates.filter((c) => !c.rule.acumulable);
    const stackable = candidates.filter((c) => !!c.rule.acumulable);

    // 3. Regla principal de las no acumulables (Best-Wins: Mayor prioridad > Mayor beneficio > Menor ID)
    let primaryWinner: { rule: DiscountRule; benefit: number } | null = null;
    if (nonStackable.length > 0) {
      primaryWinner = nonStackable.sort((a, b) => {
        if (a.rule.prioridad !== b.rule.prioridad)
          return b.rule.prioridad - a.rule.prioridad;
        if (a.benefit !== b.benefit) return b.benefit - a.benefit;
        return a.rule.id < b.rule.id ? -1 : 1;
      })[0];
    }

    const appliedRules: AppliedRuleItem[] = [];
    let currentTotalBenefit = 0;

    // Si hay regla principal no acumulable ganadora, se aplica primero
    if (primaryWinner) {
      const allowedBenefit = Math.min(primaryWinner.benefit, baseGravadaTotal);
      appliedRules.push({ rule: primaryWinner.rule, benefit: allowedBenefit });
      currentTotalBenefit = allowedBenefit;
    }

    // 4. Agregar reglas acumulables respetando la salvaguarda de no superar el 100% de la base gravada
    stackable.sort((a, b) => {
      if (a.rule.prioridad !== b.rule.prioridad)
        return b.rule.prioridad - a.rule.prioridad;
      if (a.benefit !== b.benefit) return b.benefit - a.benefit;
      return a.rule.id < b.rule.id ? -1 : 1;
    });

    for (const item of stackable) {
      if (currentTotalBenefit >= baseGravadaTotal) break;
      const remainingCapacity = round2(baseGravadaTotal - currentTotalBenefit);
      const effectiveBenefit = Math.min(item.benefit, remainingCapacity);
      if (effectiveBenefit > 0) {
        appliedRules.push({ rule: item.rule, benefit: effectiveBenefit });
        currentTotalBenefit = round2(currentTotalBenefit + effectiveBenefit);
      }
    }

    if (appliedRules.length === 0) {
      if (candidates.length === 0) return null;
      appliedRules.push({ rule: candidates[0].rule, benefit: 0 });
      currentTotalBenefit = 0;
    }

    const topRule = appliedRules[0].rule;

    return {
      rule: topRule,
      benefit: currentTotalBenefit,
      baseGravada,
      appliedRules,
    };
  }
}

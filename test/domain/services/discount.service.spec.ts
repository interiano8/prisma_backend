import { DiscountService } from '../../../src/domain/services/discount.service';
import {
  DiscountRule,
} from '../../../src/domain/entities/product.entity';
import { computeLineTotals } from '../../../src/domain/services/discount.service';

describe('computeLineTotals', () => {
  it('descuento sobre base gravada con ISV (156.52 / 23.48 / 180.00)', () => {
    // precio 100 con ISV 15%, qty 2, descuento 10% sobre base
    const t = computeLineTotals(100, 2, 15, 17.3913);
    expect(t.descuento).toBe(17.39);
    expect(t.baseGravadaTotal).toBe(173.91);
    expect(t.baseDescontada).toBe(156.52);
    expect(t.montoIsv).toBe(23.48);
    expect(t.montoConIsv).toBe(180);
  });

  it('línea sin descuento conserva ISV', () => {
    const t = computeLineTotals(115, 2, 15, 0);
    expect(t.baseGravadaTotal).toBe(200);
    expect(t.baseDescontada).toBe(200);
    expect(t.montoIsv).toBe(30);
    expect(t.montoConIsv).toBe(230);
  });

  it('base + ISV cuadran exacto con el total', () => {
    const t = computeLineTotals(45.37, 1, 15, 3.95);
    expect(t.baseDescontada).toBe(35.5);
    expect(t.montoIsv).toBe(5.33);
    expect(t.montoConIsv).toBe(40.83);
    expect(t.baseDescontada + t.montoIsv).toBe(t.montoConIsv);
  });

  it('dos líneas idénticas suman sin diferencia de centavos', () => {
    const a = computeLineTotals(45.37, 1, 15, 3.95);
    const b = computeLineTotals(45.37, 1, 15, 3.95);
    expect(a.montoConIsv).toBe(40.83);
    expect(b.montoConIsv).toBe(40.83);
    expect(a.montoConIsv + b.montoConIsv).toBe(81.66);
  });
});

describe('DiscountService', () => {
  let service: DiscountService;

  beforeEach(() => {
    service = new DiscountService();
  });

  describe('evaluateBestRule', () => {
    it('retorna null cuando no hay reglas', () => {
      const result = service.evaluateBestRule([], 2, 100, 'IVA');
      expect(result).toBeNull();
    });

    it('filtra por umbral de cantidad (por línea)', () => {
      const rule: DiscountRule = {
        id: 'R1',
        cantidadMinima: 10,
        tipoBeneficio: 'PORCENTAJE',
        valor: 5,
        prioridad: 0,
      };
      expect(service.evaluateBestRule([rule], 9, 100, 'IVA')).toBeNull();
      expect(service.evaluateBestRule([rule], 12, 100, 'IVA')).not.toBeNull();
    });

    it('best-wins: gana la de mayor prioridad', () => {
      const low: DiscountRule = {
        id: 'R1',
        tipoBeneficio: 'PORCENTAJE',
        valor: 50,
        prioridad: 5,
      };
      const high: DiscountRule = {
        id: 'R2',
        tipoBeneficio: 'PORCENTAJE',
        valor: 10,
        prioridad: 10,
      };
      const result = service.evaluateBestRule([low, high], 1, 100, 'IVA');
      expect(result?.rule.id).toBe('R2');
    });

    it('desempate por mayor beneficio', () => {
      const a: DiscountRule = {
        id: 'R1',
        tipoBeneficio: 'PORCENTAJE',
        valor: 8,
        prioridad: 0,
      };
      const b: DiscountRule = {
        id: 'R2',
        tipoBeneficio: 'PORCENTAJE',
        valor: 5,
        prioridad: 0,
      };
      const result = service.evaluateBestRule([a, b], 1, 100, 'IVA');
      expect(result?.rule.id).toBe('R1');
    });

    it('calcula PORCENTAJE sobre base gravada (sin ISV)', () => {
      const rule: DiscountRule = {
        id: 'R1',
        tipoBeneficio: 'PORCENTAJE',
        valor: 10,
        prioridad: 0,
      };
      const result = service.evaluateBestRule([rule], 2, 115, 'IVA15');
      expect(result?.baseGravada).toBe(100);
      expect(result?.benefit).toBe(20);
    });

    it('calcula MONTO_FIJO por unidad', () => {
      const rule: DiscountRule = {
        id: 'R1',
        tipoBeneficio: 'MONTO_FIJO',
        valor: 3,
        prioridad: 0,
      };
      const result = service.evaluateBestRule([rule], 5, 100, 'IVA');
      expect(result?.benefit).toBe(15);
    });

    it('calcula MONTO_VOLUMEN (litros)', () => {
      const rule: DiscountRule = {
        id: 'R1',
        tipoBeneficio: 'MONTO_VOLUMEN',
        valor: 0.5,
        unidadVolumen: 'LITRO',
        prioridad: 0,
      };
      const result = service.evaluateBestRule([rule], 200, 100, 'IVA');
      expect(result?.benefit).toBe(100);
    });
  });

  describe('evaluateBestRule (casos de borde)', () => {
    const rule = (overrides: Partial<DiscountRule>): DiscountRule => ({
      id: 'r',
      tipoBeneficio: 'PORCENTAJE',
      valor: 10,
      prioridad: 0,
      ...overrides,
    });

    it('isvRate detecta grupos 15 y 18', () => {
      const service = new DiscountService();
      expect(service.evaluateBestRule([rule({})], 1, 100, 'ISV15')?.benefit).toBe(8.7);
      expect(service.evaluateBestRule([rule({})], 1, 100, 'ISV18')?.benefit).toBe(8.48);
    });

    it('acepta cantidad igual a la mínima', () => {
      const service = new DiscountService();
      const result = service.evaluateBestRule(
        [rule({ cantidadMinima: 10 })],
        10,
        100,
        'IVA',
      );
      expect(result?.benefit).toBe(100);
    });

    it('desempata por beneficio cuando la prioridad es igual', () => {
      const service = new DiscountService();
      const result = service.evaluateBestRule(
        [
          rule({ id: 'b', valor: 5, prioridad: 1 }),
          rule({ id: 'a', valor: 20, prioridad: 1 }),
        ],
        1,
        100,
        'IVA',
      );
      expect(result?.rule.id).toBe('a');
      expect(result?.benefit).toBe(20);
    });

    it('desempata por id cuando beneficio y prioridad son iguales', () => {
      const service = new DiscountService();
      const result = service.evaluateBestRule(
        [
          rule({ id: 'z', valor: 10, prioridad: 1 }),
          rule({ id: 'a', valor: 10, prioridad: 1 }),
        ],
        1,
        100,
        'IVA',
      );
      expect(result?.rule.id).toBe('a');
    });

    it('tipo de beneficio desconocido produce beneficio 0', () => {
      const service = new DiscountService();
      const result = service.evaluateBestRule(
        [rule({ tipoBeneficio: 'DESCONOCIDO' as any })],
        1,
        100,
        'IVA',
      );
      expect(result?.benefit).toBe(0);
    });
  });

  describe('computeLineTotals (borde de redondeo)', () => {
    it('usa EPSILON para redondear 2.675 a 2.68', () => {
      const t = computeLineTotals(2.675, 1, 0, 0);
      expect(t.baseGravadaTotal).toBe(2.68);
    });
  });
});

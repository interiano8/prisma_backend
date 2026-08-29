import {
  FALLBACK_HOSES,
  buildMockPumpTransactions,
} from '../../../src/application/services/dispenser-fallbacks';
import type { LocalDispenser } from '../../../src/application/services/dispensers.service';

const local = (overrides: Partial<LocalDispenser>): LocalDispenser => ({
  pumpId: 1,
  state: 'idle',
  productName: 'Súper',
  gallons: 0,
  amount: 0,
  unitPrice: 30,
  limitAmount: null,
  saleId: null,
  ...overrides,
});

describe('dispenser-fallbacks', () => {
  it('FALLBACK_HOSES contiene 12 mangueras de 4 bombas', () => {
    expect(FALLBACK_HOSES).toHaveLength(12);
    expect(FALLBACK_HOSES.filter((h) => h.pumpId === 1)).toHaveLength(3);
    expect(FALLBACK_HOSES.every((h) => h.esVisible === true)).toBe(true);
  });

  describe('buildMockPumpTransactions', () => {
    const now = new Date('2026-01-01T12:00:00Z');

    it('siempre incluye la transacción atrasada y la facturada', () => {
      const result = buildMockPumpTransactions(2, undefined, now);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.estado)).toEqual([
        'Sin Facturar',
        'Facturado',
      ]);
      expect(result[0].ciclo).toBe('Atrasada');
      expect(result[1].ciclo).toBe('Finalizada');
    });

    it('incluye la transacción local cuando está colgada', () => {
      const result = buildMockPumpTransactions(
        1,
        local({ state: 'colgada', amount: 90, gallons: 3, saleId: 555 }),
        now,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        saleId: 555,
        estado: 'Sin Facturar',
        ciclo: 'Libre',
        amount: 90,
      });
    });

    it('incluye la transacción local cuando tiene amount > 0 sin estar colgada', () => {
      const result = buildMockPumpTransactions(
        1,
        local({ state: 'fueling', amount: 50 }),
        now,
      );

      expect(result).toHaveLength(3);
      expect(result[0].estado).toBe('Sin Facturar');
      expect(result[0].ciclo).toBe('Libre');
    });

    it('no incluye la local si está idle sin monto', () => {
      const result = buildMockPumpTransactions(
        1,
        local({ state: 'idle', amount: 0 }),
        now,
      );

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.ciclo !== 'Libre')).toBe(true);
    });

    it('usa un saleId por defecto cuando la local no tiene uno', () => {
      const result = buildMockPumpTransactions(
        3,
        local({ state: 'colgada', amount: 10 }),
        now,
      );

      expect(result[0].saleId).toBe(998100 + 3);
    });

    it('usa SUPER por defecto cuando la local no tiene productName', () => {
      const result = buildMockPumpTransactions(
        1,
        local({ state: 'colgada', amount: 50, productName: '' }),
        now,
      );

      expect(result[0].grade).toBe('SUPER');
      expect(result[0].combustible).toBe('SUPER');
    });
  });
});

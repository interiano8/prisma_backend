import { InvoicePricingService } from '../../../src/domain/services/invoice-pricing.service';
import { InvoiceItem } from '../../../src/domain/entities/invoice-item.entity';

describe('InvoicePricingService', () => {
  let service: InvoicePricingService;

  beforeEach(() => {
    service = new InvoicePricingService();
  });

  describe('getVatPercent', () => {
    it('should return 15 for ISV_15', () => {
      expect(service.getVatPercent('ISV_15')).toBe(15);
    });

    it('should return 15 for lowercase isv_15', () => {
      expect(service.getVatPercent('isv_15')).toBe(15);
    });

    it('should return 18 for ISV_18', () => {
      expect(service.getVatPercent('ISV_18')).toBe(18);
    });

    it('should return 0 for unknown VAT group', () => {
      expect(service.getVatPercent('EXENTO')).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(service.getVatPercent('')).toBe(0);
    });

    it('should handle mixed case ISV_18', () => {
      expect(service.getVatPercent('Isv_18')).toBe(18);
    });
  });

  describe('calculateVatAmount', () => {
    it('should calculate VAT at 15% from amount including VAT', () => {
      const amount = 115;
      const vatPercent = 15;
      const result = service.calculateVatAmount(amount, vatPercent);

      expect(result).toBeCloseTo(15, 2);
    });

    it('should calculate VAT at 18% from amount including VAT', () => {
      const amount = 118;
      const vatPercent = 18;
      const result = service.calculateVatAmount(amount, vatPercent);

      expect(result).toBeCloseTo(18, 2);
    });

    it('should return 0 VAT when rate is 0', () => {
      const result = service.calculateVatAmount(100, 0);

      expect(result).toBe(0);
    });

    it('should handle small amounts', () => {
      const amount = 45.99;
      const vatPercent = 15;
      const result = service.calculateVatAmount(amount, vatPercent);

      expect(result).toBeCloseTo(6.0, 2);
    });

    it('should handle price that does not include VAT (vatPercent 0 for exempt)', () => {
      const result = service.calculateVatAmount(200, 0);

      expect(result).toBe(0);
    });
  });

  describe('calculateLineTotal', () => {
    it('should calculate line total without discount', () => {
      const item: InvoiceItem = {
        code: 'PROD001',
        description: 'Coca Cola',
        qty: 2,
        price: 25,
        tax: 6.52,
        discount: 0,
        total: 50,
      };

      const result = service.calculateLineTotal(item);

      expect(result).toBe(50);
    });

    it('should calculate line total with discount', () => {
      const item: InvoiceItem = {
        code: 'PROD002',
        description: 'Item with discount',
        qty: 3,
        price: 100,
        tax: 39.13,
        discount: 30,
        total: 270,
      };

      const result = service.calculateLineTotal(item);

      expect(result).toBe(270);
    });

    it('should treat missing discount as 0', () => {
      const item: InvoiceItem = {
        code: 'PROD003',
        description: 'No discount field',
        qty: 1,
        price: 50,
        tax: 0,
        discount: 0,
        total: 50,
      };

      const result = service.calculateLineTotal(item);

      expect(result).toBe(50);
    });

    it('should handle single item with zero quantity', () => {
      const item: InvoiceItem = {
        code: 'PROD004',
        description: 'Zero qty',
        qty: 0,
        price: 100,
        tax: 0,
        discount: 0,
        total: 0,
      };

      const result = service.calculateLineTotal(item);

      expect(result).toBe(0);
    });
  });

  describe('calculateInvoiceTotals', () => {
    it('should calculate totals for a single item invoice', () => {
      const items: InvoiceItem[] = [
        {
          code: 'PROD001',
          description: 'Single Product',
          qty: 1,
          price: 100,
          tax: 15,
          discount: 0,
          total: 115,
        },
      ];

      const result = service.calculateInvoiceTotals(items);

      expect(result.subtotal).toBe(100);
      expect(result.discount).toBe(0);
      expect(result.tax).toBe(15);
      expect(result.total).toBe(115);
    });

    it('should calculate totals for multiple items', () => {
      const items: InvoiceItem[] = [
        {
          code: 'PROD001',
          description: 'Product A',
          qty: 2,
          price: 50,
          tax: 13.04,
          discount: 0,
          total: 100,
        },
        {
          code: 'PROD002',
          description: 'Product B',
          qty: 1,
          price: 200,
          tax: 26.09,
          discount: 20,
          total: 180,
        },
      ];

      const result = service.calculateInvoiceTotals(items);

      expect(result.subtotal).toBe(300);
      expect(result.discount).toBe(20);
      expect(result.tax).toBeCloseTo(39.13, 2);
      expect(result.total).toBeCloseTo(319.13, 2);
    });

    it('should return zeros for empty items array', () => {
      const result = service.calculateInvoiceTotals([]);

      expect(result.subtotal).toBe(0);
      expect(result.discount).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle items with missing optional tax and discount', () => {
      const items: InvoiceItem[] = [
        {
          code: 'PROD001',
          description: 'Minimal item',
          qty: 3,
          price: 50,
          tax: 0,
          discount: 0,
          total: 150,
        },
      ];

      const result = service.calculateInvoiceTotals(items);

      expect(result.subtotal).toBe(150);
      expect(result.discount).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(150);
    });

    it('should handle items with large quantities', () => {
      const items: InvoiceItem[] = [
        {
          code: 'BULK',
          description: 'Bulk item',
          qty: 1000,
          price: 1.5,
          tax: 195.65,
          discount: 100,
          total: 1400,
        },
      ];

      const result = service.calculateInvoiceTotals(items);

      expect(result.subtotal).toBe(1500);
      expect(result.discount).toBe(100);
      expect(result.tax).toBeCloseTo(195.65, 2);
      expect(result.total).toBeCloseTo(1595.65, 2);
    });
  });
});

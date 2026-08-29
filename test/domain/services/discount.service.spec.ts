import { DiscountService } from '../../../src/domain/services/discount.service';
import { Discount } from '../../../src/domain/entities/product.entity';

describe('DiscountService', () => {
  let service: DiscountService;

  beforeEach(() => {
    service = new DiscountService();
  });

  describe('calculateDiscountAmount', () => {
    it('should calculate discount with percentage', () => {
      const discount: Discount = {
        codigoCliente: 'CUST001',
        codigoItem: 'PROD001',
        porcentaje: 10,
      };

      const result = service.calculateDiscountAmount(100, 2, discount);

      expect(result).toBe(20);
    });

    it('should calculate discount with zero percentage', () => {
      const discount: Discount = {
        codigoCliente: 'CUST001',
        codigoItem: 'PROD001',
        porcentaje: 0,
        amountPerGallon: 0.5,
      };

      const result = service.calculateDiscountAmount(100, 10, discount);

      expect(result).toBe(5);
    });

    it('should calculate discount with amountPerGallon', () => {
      const discount: Discount = {
        codigoCliente: 'CUST002',
        codigoItem: 'FUEL001',
        porcentaje: 0,
        amountPerGallon: 0.75,
      };

      const result = service.calculateDiscountAmount(90, 15, discount);

      expect(result).toBe(11.25);
    });

    it('should calculate discount with amountPerLiter', () => {
      const discount: Discount = {
        codigoCliente: 'CUST003',
        codigoItem: 'FUEL002',
        porcentaje: 0,
        amountPerLiter: 0.2,
      };

      const result = service.calculateDiscountAmount(90, 10, discount);

      expect(result).toBe(2.0);
    });

    it('should prioritize percentage over amountPerGallon', () => {
      const discount: Discount = {
        codigoCliente: 'CUST004',
        codigoItem: 'MIXED',
        porcentaje: 15,
        amountPerGallon: 2.0,
      };

      const result = service.calculateDiscountAmount(80, 5, discount);

      expect(result).toBe(60);
    });

    it('should return 0 when no discount criteria match', () => {
      const discount: Discount = {
        codigoCliente: 'CUST005',
        codigoItem: 'PROD999',
        porcentaje: 0,
      };

      const result = service.calculateDiscountAmount(100, 1, discount);

      expect(result).toBe(0);
    });

    it('should return 0 when amountPerGallon is zero or negative', () => {
      const discount: Discount = {
        codigoCliente: 'CUST006',
        codigoItem: 'FUEL',
        porcentaje: 0,
        amountPerGallon: 0,
        amountPerLiter: -1,
      };

      const result = service.calculateDiscountAmount(100, 5, discount);

      expect(result).toBe(0);
    });
  });

  describe('isDiscountActive', () => {
    it('should return true for active discount in valid date range', () => {
      const discount: Discount = {
        codigoCliente: 'CUST001',
        codigoItem: 'PROD001',
        porcentaje: 10,
        startingDate: '2025-01-01',
        endingDate: '2027-12-31',
        active: true,
      };

      const result = service.isDiscountActive(discount);

      expect(result).toBe(true);
    });

    it('should return true when no date range specified and active not false', () => {
      const discount: Discount = {
        codigoCliente: 'CUST002',
        codigoItem: 'PROD002',
        porcentaje: 5,
      };

      const result = service.isDiscountActive(discount);

      expect(result).toBe(true);
    });

    it('should return false when active flag is false', () => {
      const discount: Discount = {
        codigoCliente: 'CUST003',
        codigoItem: 'PROD003',
        porcentaje: 10,
        active: false,
      };

      const result = service.isDiscountActive(discount);

      expect(result).toBe(false);
    });

    it('should return false when discount has expired (endingDate in the past)', () => {
      const discount: Discount = {
        codigoCliente: 'CUST004',
        codigoItem: 'PROD004',
        porcentaje: 10,
        startingDate: '2020-01-01',
        endingDate: '2021-12-31',
        active: true,
      };

      const result = service.isDiscountActive(discount);

      expect(result).toBe(false);
    });

    it('should return false when discount has not started yet (startingDate in the future)', () => {
      const discount: Discount = {
        codigoCliente: 'CUST005',
        codigoItem: 'PROD005',
        porcentaje: 10,
        startingDate: '2030-01-01',
        endingDate: '2031-12-31',
        active: true,
      };

      const result = service.isDiscountActive(discount);

      expect(result).toBe(false);
    });

    it('should return false with only startingDate set and in the past but active=false', () => {
      const discount: Discount = {
        codigoCliente: 'CUST006',
        codigoItem: 'PROD006',
        porcentaje: 5,
        startingDate: '2020-01-01',
        active: false,
      };

      const result = service.isDiscountActive(discount);

      expect(result).toBe(false);
    });
  });
});

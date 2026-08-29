import { FuelCalculatorService } from '../../../src/domain/services/fuel-calculator.service';

describe('FuelCalculatorService', () => {
  let service: FuelCalculatorService;

  beforeEach(() => {
    service = new FuelCalculatorService();
  });

  describe('calculateFuelAmount', () => {
    it('should multiply volume by unit price', () => {
      const result = service.calculateFuelAmount(10, 90.5);

      expect(result).toBe(905.0);
    });

    it('should return 0 when volume is 0', () => {
      const result = service.calculateFuelAmount(0, 90.5);

      expect(result).toBe(0);
    });

    it('should return 0 when unit price is 0', () => {
      const result = service.calculateFuelAmount(10, 0);

      expect(result).toBe(0);
    });

    it('should handle fractional gallons', () => {
      const result = service.calculateFuelAmount(5.75, 88.3);

      expect(result).toBeCloseTo(507.725, 3);
    });
  });

  describe('calculateVolume', () => {
    it('should divide amount by unit price', () => {
      const result = service.calculateVolume(500, 100);

      expect(result).toBe(5);
    });

    it('should return 0 when unit price is 0', () => {
      const result = service.calculateVolume(500, 0);

      expect(result).toBe(0);
    });

    it('should handle fractional results', () => {
      const result = service.calculateVolume(100, 3);

      expect(result).toBeCloseTo(33.333, 3);
    });

    it('should return 0 when amount is 0', () => {
      const result = service.calculateVolume(0, 90.5);

      expect(result).toBe(0);
    });
  });

  describe('formatVolume', () => {
    it('should round to 2 decimal places', () => {
      const result = service.formatVolume(10.567);

      expect(result).toBe(10.57);
    });

    it('should handle whole numbers', () => {
      const result = service.formatVolume(15);

      expect(result).toBe(15.0);
    });

    it('should round down when appropriate', () => {
      const result = service.formatVolume(10.994);

      expect(result).toBe(10.99);
    });

    it('should return a number type', () => {
      const result = service.formatVolume(5.5);

      expect(typeof result).toBe('number');
    });
  });

  describe('formatAmount', () => {
    it('should round to 2 decimal places', () => {
      const result = service.formatAmount(99.999);

      expect(result).toBe(100.0);
    });

    it('should handle whole numbers', () => {
      const result = service.formatAmount(100);

      expect(result).toBe(100.0);
    });

    it('should round down when appropriate', () => {
      const result = service.formatAmount(50.994);

      expect(result).toBe(50.99);
    });

    it('should return a number type', () => {
      const result = service.formatAmount(25.0);

      expect(typeof result).toBe('number');
    });
  });
});

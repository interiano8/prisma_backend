import { ValueToLettersService } from '../../../src/domain/services/value-to-letters.service';

describe('ValueToLettersService', () => {
  let service: ValueToLettersService;

  beforeEach(() => {
    service = new ValueToLettersService();
  });

  describe('convert', () => {
    it('should convert 0', () => {
      const result = service.convert(0);
      expect(result).toBe('Cero Lempiras Con Cero Centavos');
    });

    it('should convert 1', () => {
      const result = service.convert(1);
      expect(result.toLowerCase()).toContain('un');
      expect(result.toLowerCase()).toContain('lempira');
    });

    it('should convert 10', () => {
      const result = service.convert(10);
      expect(result.toLowerCase()).toContain('diez');
      expect(result.toLowerCase()).toContain('lempiras');
    });

    it('should convert 100', () => {
      const result = service.convert(100);
      expect(result.toLowerCase()).toContain('cien');
      expect(result.toLowerCase()).toContain('lempiras');
      expect(result.toLowerCase()).toContain('cero centavos');
    });

    it('should convert 1000', () => {
      const result = service.convert(1000);
      expect(result.toLowerCase()).toContain('mil');
      expect(result.toLowerCase()).toContain('lempiras');
    });

    it('should convert 1500', () => {
      const result = service.convert(1500);
      expect(result.toLowerCase()).toContain('mil');
      expect(result.toLowerCase()).toContain('quinientos');
    });

    it('should convert 15 with cents', () => {
      const result = service.convert(15.75);
      expect(result.toLowerCase()).toContain('quince');
      expect(result.toLowerCase()).toContain('setenta');
      expect(result.toLowerCase()).toContain('cinco');
    });

    it('should convert 21', () => {
      const result = service.convert(21);
      expect(result.toLowerCase()).toContain('veintiuno');
    });

    it('should convert 99.99', () => {
      const result = service.convert(99.99);
      expect(result.toLowerCase()).toContain('noventa');
      expect(result.toLowerCase()).toContain('nueve');
    });

    it('should convert 101', () => {
      const result = service.convert(101);
      expect(result.toLowerCase()).toContain('ciento');
      expect(result.toLowerCase()).toContain('uno');
    });

    it('should convert 1,000,000', () => {
      const result = service.convert(1000000);
      expect(result.toLowerCase()).toContain('millón');
    });

    it('should convert 2,000,000', () => {
      const result = service.convert(2000000);
      expect(result.toLowerCase()).toContain('millones');
    });

    it('should convert 1,250,000.50', () => {
      const result = service.convert(1250000.5);
      expect(result.toLowerCase()).toContain('millón');
      expect(result.toLowerCase()).toContain('doscientos');
      expect(result.toLowerCase()).toContain('cincuenta');
    });

    it('should convert 12', () => {
      const result = service.convert(12);
      expect(result.toLowerCase()).toContain('doce');
    });

    it('should convert 18', () => {
      const result = service.convert(18);
      expect(result.toLowerCase()).toContain('dieciocho');
    });

    it('should convert 30', () => {
      const result = service.convert(30);
      expect(result.toLowerCase()).toContain('treinta');
    });

    it('should convert 34 with y connector', () => {
      const result = service.convert(34);
      expect(result.toLowerCase()).toContain('treinta');
      expect(result.toLowerCase()).toContain('cuatro');
    });

    it('should convert 500', () => {
      const result = service.convert(500);
      expect(result.toLowerCase()).toContain('quinientos');
    });

    it('should convert 999,999.99', () => {
      const result = service.convert(999999.99);
      expect(result.toLowerCase()).toContain('novecientos');
      expect(result.toLowerCase()).toContain('noventa');
      expect(result.toLowerCase()).toContain('nueve');
      expect(result.toLowerCase()).toContain('mil');
    });

    it('should handle value with 100 cents rounding', () => {
      const result = service.convert(5.999);
      expect(result.toLowerCase()).toContain('cero centavos');
    });

    it('should return Title Case', () => {
      const result = service.convert(100);
      expect(result).toBe('Cien Lempiras Con Cero Centavos');
    });

    it('usa lempira singular para exactamente 1', () => {
      expect(service.convert(1)).toBe('Uno Lempira Con Cero Centavos');
    });

    it('usa centavo singular con un centavo', () => {
      expect(service.convert(1.01)).toBe('Uno Lempira Con Uno Centavo');
    });

    it('convierte veintiuno exacto', () => {
      expect(service.convert(21)).toBe('Veintiuno Lempiras Con Cero Centavos');
    });

    it('convierte miles compuestos por decenas', () => {
      expect(service.convert(12000)).toBe(
        'Doce Mil Lempiras Con Cero Centavos',
      );
    });

    it('convierte mil cien', () => {
      expect(service.convert(1100)).toBe('Mil Cien Lempiras Con Cero Centavos');
    });

    it('convierte doscientos mil', () => {
      expect(service.convert(200000)).toBe(
        'Doscientos Mil Lempiras Con Cero Centavos',
      );
    });

    it('convierte decimales con conector y', () => {
      expect(service.convert(10.99)).toBe(
        'Diez Lempiras Con Noventa Y Nueve Centavos',
      );
    });

    it('convierte decimal simple', () => {
      expect(service.convert(34.05)).toBe(
        'Treinta Y Cuatro Lempiras Con Cinco Centavos',
      );
    });

    it('maneja millones con resto', () => {
      expect(service.convert(1001000).toLowerCase()).toContain('millón');
      expect(service.convert(1001000).toLowerCase()).toContain('mil');
    });

    it.each<[number, string]>([
      [2, 'Dos Lempiras Con Cero Centavos'],
      [11, 'Once Lempiras Con Cero Centavos'],
      [16, 'Dieciséis Lempiras Con Cero Centavos'],
      [19, 'Diecinueve Lempiras Con Cero Centavos'],
      [22, 'Veintidos Lempiras Con Cero Centavos'],
      [40, 'Cuarenta Lempiras Con Cero Centavos'],
      [42, 'Cuarenta Y Dos Lempiras Con Cero Centavos'],
      [55, 'Cincuenta Y Cinco Lempiras Con Cero Centavos'],
      [68, 'Sesenta Y Ocho Lempiras Con Cero Centavos'],
      [79, 'Setenta Y Nueve Lempiras Con Cero Centavos'],
      [85, 'Ochenta Y Cinco Lempiras Con Cero Centavos'],
      [96, 'Noventa Y Seis Lempiras Con Cero Centavos'],
      [99, 'Noventa Y Nueve Lempiras Con Cero Centavos'],
      [111, 'Ciento Once Lempiras Con Cero Centavos'],
      [300, 'Trescientos Lempiras Con Cero Centavos'],
      [1234, 'Mil Doscientos Treinta Y Cuatro Lempiras Con Cero Centavos'],
      [1000001, 'Un Millón Uno Lempiras Con Cero Centavos'],
      [2.16, 'Dos Lempiras Con Dieciséis Centavos'],
      [2.22, 'Dos Lempiras Con Veintidos Centavos'],
      [2.31, 'Dos Lempiras Con Treinta Y Uno Centavos'],
      [2.42, 'Dos Lempiras Con Cuarenta Y Dos Centavos'],
      [2.55, 'Dos Lempiras Con Cincuenta Y Cinco Centavos'],
      [2.68, 'Dos Lempiras Con Sesenta Y Ocho Centavos'],
      [2.79, 'Dos Lempiras Con Setenta Y Nueve Centavos'],
      [2.85, 'Dos Lempiras Con Ochenta Y Cinco Centavos'],
      [2.96, 'Dos Lempiras Con Noventa Y Seis Centavos'],
      [2.1, 'Dos Lempiras Con Diez Centavos'],
      [2.2, 'Dos Lempiras Con Veinte Centavos'],
      [20, 'Veinte Lempiras Con Cero Centavos'],
      [2.3, 'Dos Lempiras Con Treinta Centavos'],
      [0.999, 'Cero Lempiras Con Cero Centavos'],
      [2.011, 'Dos Lempiras Con Uno Centavo'],
      [4, 'Cuatro Lempiras Con Cero Centavos'],
      [5, 'Cinco Lempiras Con Cero Centavos'],
      [6, 'Seis Lempiras Con Cero Centavos'],
      [7, 'Siete Lempiras Con Cero Centavos'],
      [8, 'Ocho Lempiras Con Cero Centavos'],
      [9, 'Nueve Lempiras Con Cero Centavos'],
      [12, 'Doce Lempiras Con Cero Centavos'],
      [13, 'Trece Lempiras Con Cero Centavos'],
      [14, 'Catorce Lempiras Con Cero Centavos'],
      [15, 'Quince Lempiras Con Cero Centavos'],
      [17, 'Diecisiete Lempiras Con Cero Centavos'],
      [18, 'Dieciocho Lempiras Con Cero Centavos'],
      [30, 'Treinta Lempiras Con Cero Centavos'],
      [50, 'Cincuenta Lempiras Con Cero Centavos'],
      [400, 'Cuatrocientos Lempiras Con Cero Centavos'],
      [500, 'Quinientos Lempiras Con Cero Centavos'],
      [600, 'Seiscientos Lempiras Con Cero Centavos'],
      [700, 'Setecientos Lempiras Con Cero Centavos'],
      [800, 'Ochocientos Lempiras Con Cero Centavos'],
      [900, 'Novecientos Lempiras Con Cero Centavos'],
      [2.04, 'Dos Lempiras Con Cuatro Centavos'],
      [2.05, 'Dos Lempiras Con Cinco Centavos'],
      [2.06, 'Dos Lempiras Con Seis Centavos'],
      [2.07, 'Dos Lempiras Con Siete Centavos'],
      [2.08, 'Dos Lempiras Con Ocho Centavos'],
      [2.09, 'Dos Lempiras Con Nueve Centavos'],
      [2.12, 'Dos Lempiras Con Doce Centavos'],
      [2.13, 'Dos Lempiras Con Trece Centavos'],
      [2.14, 'Dos Lempiras Con Catorce Centavos'],
      [2.15, 'Dos Lempiras Con Quince Centavos'],
      [2.17, 'Dos Lempiras Con Diecisiete Centavos'],
      [2.18, 'Dos Lempiras Con Dieciocho Centavos'],
    ])('convierte %d exacto a %s', (value, expected) => {
      expect(service.convert(value)).toBe(expected);
    });
  });
});

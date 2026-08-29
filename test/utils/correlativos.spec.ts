import {
  padStoreId,
  nextInvoiceNumber,
  nextTrId,
} from '../../src/utils/correlativos';

describe('correlativos', () => {
  describe('padStoreId', () => {
    it('rellena storeId numérico a 3 dígitos', () => {
      expect(padStoreId('1')).toBe('001');
      expect(padStoreId('42')).toBe('042');
      expect(padStoreId('001')).toBe('001');
    });

    it('mantiene storeId no numérico tal cual', () => {
      expect(padStoreId('ABC')).toBe('ABC');
    });

    it('recorta espacios y maneja vacío', () => {
      expect(padStoreId(' 7 ')).toBe('007');
      expect(padStoreId('')).toBe('');
    });
  });

  describe('nextInvoiceNumber', () => {
    it('incrementa el número de factura', () => {
      expect(nextInvoiceNumber('00000000000000000001')).toBe(
        '0000000000000000002',
      );
    });

    it('devuelve tal cual si es demasiado corto', () => {
      expect(nextInvoiceNumber('123')).toBe('123');
    });

    it('devuelve tal cual si el sufijo no es numérico', () => {
      expect(nextInvoiceNumber('00000000000ABC')).toBe('00000000000ABC');
    });

    it('devuelve tal cual si es vacío', () => {
      expect(nextInvoiceNumber('')).toBe('');
    });
  });

  describe('nextTrId', () => {
    it('incrementa el id de transacción', () => {
      expect(nextTrId('00000000000000001')).toBe('00000000000000002');
    });

    it('devuelve tal cual si es demasiado corto', () => {
      expect(nextTrId('123')).toBe('123');
    });

    it('devuelve tal cual si el sufijo no es numérico', () => {
      expect(nextTrId('000000XYZ')).toBe('000000XYZ');
    });

    it('devuelve tal cual si es vacío', () => {
      expect(nextTrId('')).toBe('');
    });
  });
});

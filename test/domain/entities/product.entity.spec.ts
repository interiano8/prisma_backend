import { Product } from '../../../src/domain/entities/product.entity';

describe('Product entity', () => {
  describe('valid Product objects', () => {
    it('should create a basic product', () => {
      const product: Product = {
        code: 'PROD001',
        description: 'Coca Cola 600ml',
        unitPrice: 25.0,
        category: 'BEBIDAS',
        vatGroup: 'ISV_15',
        priceIncludesVat: true,
      };

      expect(product.code).toBe('PROD001');
      expect(product.description).toBe('Coca Cola 600ml');
      expect(product.unitPrice).toBe(25.0);
      expect(product.category).toBe('BEBIDAS');
      expect(product.vatGroup).toBe('ISV_15');
      expect(product.priceIncludesVat).toBe(true);
    });

    it('should create a product with blocked flag', () => {
      const product: Product = {
        code: 'PROD002',
        description: 'Blocked Product',
        unitPrice: 10.0,
        category: 'GENERAL',
        vatGroup: 'ISV_18',
        priceIncludesVat: false,
        blocked: true,
      };

      expect(product.blocked).toBe(true);
    });

    it('should create a product that does not include VAT in price', () => {
      const product: Product = {
        code: 'PROD003',
        description: 'Wholesale Item',
        unitPrice: 100.0,
        category: 'MAYOREO',
        vatGroup: 'ISV_18',
        priceIncludesVat: false,
      };

      expect(product.priceIncludesVat).toBe(false);
    });

    it('should support zero-rated VAT group', () => {
      const product: Product = {
        code: 'PROD004',
        description: 'Exempt Product',
        unitPrice: 50.0,
        category: 'EXENTO',
        vatGroup: 'EXENTO',
        priceIncludesVat: false,
      };

      expect(product.vatGroup).toBe('EXENTO');
    });
  });
});

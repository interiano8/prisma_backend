import { Product, Discount } from '../../../src/domain/entities/product.entity';

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

  describe('Discount interface', () => {
    it('should create a percentage discount', () => {
      const discount: Discount = {
        codigoCliente: 'CUST001',
        codigoItem: 'PROD001',
        porcentaje: 10,
      };

      expect(discount.codigoCliente).toBe('CUST001');
      expect(discount.codigoItem).toBe('PROD001');
      expect(discount.porcentaje).toBe(10);
    });

    it('should create a per-gallon discount with date range', () => {
      const discount: Discount = {
        codigoCliente: 'CUST002',
        codigoItem: 'FUEL001',
        porcentaje: 0,
        amountPerGallon: 0.5,
        startingDate: '2026-01-01',
        endingDate: '2026-12-31',
        active: true,
      };

      expect(discount.amountPerGallon).toBe(0.5);
      expect(discount.startingDate).toBe('2026-01-01');
      expect(discount.endingDate).toBe('2026-12-31');
      expect(discount.active).toBe(true);
    });

    it('should create a per-liter discount', () => {
      const discount: Discount = {
        codigoCliente: 'CUST003',
        codigoItem: 'FUEL002',
        porcentaje: 0,
        amountPerLiter: 0.13,
        active: true,
      };

      expect(discount.amountPerLiter).toBe(0.13);
    });

    it('should support optional fields as undefined', () => {
      const discount: Discount = {
        codigoCliente: 'CUST004',
        codigoItem: 'PROD005',
        porcentaje: 5,
      };

      expect(discount.customerRTN).toBeUndefined();
      expect(discount.storeID).toBeUndefined();
      expect(discount.startingDate).toBeUndefined();
      expect(discount.endingDate).toBeUndefined();
      expect(discount.amountPerGallon).toBeUndefined();
      expect(discount.amountPerLiter).toBeUndefined();
      expect(discount.active).toBeUndefined();
    });
  });
});

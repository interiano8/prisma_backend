import {
  Invoice,
  InvoicePayment,
  CreateInvoiceCommand,
} from '../../../src/domain/entities/invoice.entity';
import { InvoiceItem } from '../../../src/domain/entities/invoice-item.entity';

describe('Invoice entity', () => {
  describe('InvoiceItem', () => {
    it('should create a valid invoice line item', () => {
      const item: InvoiceItem = {
        code: 'PROD001',
        description: 'Coca Cola 600ml',
        qty: 2,
        price: 25.0,
        tax: 6.52,
        discount: 0,
        total: 50.0,
      };

      expect(item.code).toBe('PROD001');
      expect(item.description).toBe('Coca Cola 600ml');
      expect(item.qty).toBe(2);
      expect(item.price).toBe(25.0);
      expect(item.tax).toBe(6.52);
      expect(item.discount).toBe(0);
      expect(item.total).toBe(50.0);
    });

    it('should create an invoice item with optional saleId', () => {
      const item: InvoiceItem = {
        code: 'FUEL001',
        description: 'Gasolina Super',
        qty: 10,
        price: 90.5,
        tax: 0,
        discount: 5.0,
        total: 900.0,
        saleId: 12345,
      };

      expect(item.saleId).toBe(12345);
    });

    it('should allow zero discount', () => {
      const item: InvoiceItem = {
        code: 'PROD002',
        description: 'Agua Pura',
        qty: 1,
        price: 15.0,
        tax: 1.96,
        discount: 0,
        total: 15.0,
      };

      expect(item.discount).toBe(0);
      expect(item.tax).toBeCloseTo(1.96, 2);
    });
  });

  describe('InvoicePayment', () => {
    it('should create a cash payment', () => {
      const payment: InvoicePayment = {
        method: 'EFECTIVO',
        amount: 500.0,
      };

      expect(payment.method).toBe('EFECTIVO');
      expect(payment.amount).toBe(500.0);
    });

    it('should create a payment with reference', () => {
      const payment: InvoicePayment = {
        method: 'TARJETA',
        amount: 300.0,
        reference: 'AUTH12345',
      };

      expect(payment.reference).toBe('AUTH12345');
    });
  });

  describe('Invoice', () => {
    it('should create a valid invoice with items and payments', () => {
      const items: InvoiceItem[] = [
        {
          code: 'PROD001',
          description: 'Coca Cola 600ml',
          qty: 2,
          price: 25.0,
          tax: 6.52,
          discount: 0,
          total: 50.0,
        },
      ];

      const payments: InvoicePayment[] = [
        { method: 'EFECTIVO', amount: 56.52 },
      ];

      const invoice: Invoice = {
        invoiceNo: 'F001-00000001',
        storeId: '001',
        posNo: 'POS01',
        shiftNumber: '1',
        customerNo: 'CF',
        customerName: 'CONSUMIDOR FINAL',
        items,
        payments,
        total: 56.52,
        tax: 6.52,
        discount: 0,
        createdAt: '2026-01-15T10:30:00Z',
      };

      expect(invoice.invoiceNo).toBe('F001-00000001');
      expect(invoice.storeId).toBe('001');
      expect(invoice.posNo).toBe('POS01');
      expect(invoice.shiftNumber).toBe('1');
      expect(invoice.customerNo).toBe('CF');
      expect(invoice.customerName).toBe('CONSUMIDOR FINAL');
      expect(invoice.items).toHaveLength(1);
      expect(invoice.payments).toHaveLength(1);
      expect(invoice.total).toBe(56.52);
      expect(invoice.tax).toBe(6.52);
      expect(invoice.discount).toBe(0);
      expect(invoice.createdAt).toBe('2026-01-15T10:30:00Z');
    });

    it('should support optional customer RTN', () => {
      const invoice: Invoice = {
        invoiceNo: 'F001-00000002',
        storeId: '001',
        posNo: 'POS01',
        shiftNumber: '1',
        customerNo: 'CUST001',
        customerName: 'Empresa SA',
        customerRtn: '08019001234567',
        items: [],
        payments: [],
        total: 0,
        tax: 0,
        discount: 0,
        createdAt: '2026-01-15T11:00:00Z',
      };

      expect(invoice.customerRtn).toBe('08019001234567');
    });
  });

  describe('CreateInvoiceCommand', () => {
    it('should create a command with all required fields', () => {
      const items: InvoiceItem[] = [
        {
          code: 'PROD001',
          description: 'Test Product',
          qty: 1,
          price: 100,
          tax: 15,
          discount: 0,
          total: 115,
        },
      ];

      const payments: InvoicePayment[] = [{ method: 'EFECTIVO', amount: 115 }];

      const command: CreateInvoiceCommand = {
        storeId: '001',
        posNo: 'POS01',
        shiftNumber: '1',
        customerNo: 'CF',
        customerName: 'CONSUMIDOR FINAL',
        items,
        payments,
        total: 115,
        tax: 15,
        discount: 0,
      };

      expect(command.storeId).toBe('001');
      expect(command.posNo).toBe('POS01');
      expect(command.shiftNumber).toBe('1');
      expect(command.items).toHaveLength(1);
      expect(command.payments).toHaveLength(1);
      expect(command.total).toBe(115);
      expect(command.tax).toBe(15);
      expect(command.discount).toBe(0);
    });

    it('should support optional customerRtn', () => {
      const command: CreateInvoiceCommand = {
        storeId: '001',
        posNo: 'POS01',
        shiftNumber: '1',
        customerNo: 'CUST001',
        customerName: 'Empresa SA',
        customerRtn: '08019001234567',
        items: [],
        payments: [],
        total: 0,
        tax: 0,
        discount: 0,
      };

      expect(command.customerRtn).toBe('08019001234567');
    });
  });
});

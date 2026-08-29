import { PaymentRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/payment-repository';

describe('PaymentRepositoryImpl', () => {
  it('mapea los métodos de pago activos con su imagen y flags', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        codigo: '1002',
        descripcion: ' EFECTIVO ',
        categoria: 'EFECTIVO',
        facturaContado: true,
        facturaCredito: false,
        salidaCombustible: false,
        fidelizacion: false,
        requiereReferencia: false,
        imagen: 'Efectivo.jpg',
        activo: true,
      },
    ]);

    const prisma = { metodoPago: { findMany } } as any;
    const repo = new PaymentRepositoryImpl(prisma, {
      executeInvoiceInsert: jest.fn(),
    } as any);

    const methods = await repo.getPaymentMethods();

    expect(findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { codigo: 'asc' },
    });
    expect(methods).toHaveLength(1);
    expect(methods[0]).toEqual({
      code: '1002',
      description: 'EFECTIVO',
      categoria: 'EFECTIVO',
      facturaContado: true,
      facturaCredito: false,
      salidaCombustible: false,
      fidelizacion: false,
      requiereReferencia: false,
      imagen: '/images/Efectivo.jpg',
      activo: true,
    });
  });

  it('devuelve imagen null cuando no tiene archivo', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        codigo: '1005',
        descripcion: 'TRANSFERENCIA',
        categoria: 'TRANSFERENCIA',
        facturaContado: true,
        facturaCredito: false,
        salidaCombustible: false,
        fidelizacion: false,
        requiereReferencia: true,
        imagen: null,
        activo: true,
      },
    ]);

    const repo = new PaymentRepositoryImpl(
      { metodoPago: { findMany } } as any,
      { executeInvoiceInsert: jest.fn() } as any,
    );
    const methods = await repo.getPaymentMethods();

    expect(methods[0].imagen).toBeNull();
    expect(methods[0].requiereReferencia).toBe(true);
  });

  it('devuelve lista vacía si la consulta falla', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('db down'));
    const repo = new PaymentRepositoryImpl(
      { metodoPago: { findMany } } as any,
      { executeInvoiceInsert: jest.fn() } as any,
    );

    await expect(repo.getPaymentMethods()).resolves.toEqual([]);
  });

  it('processPayment inserta la venta real y devuelve el número de factura', async () => {
    const executeInvoiceInsert = jest.fn().mockResolvedValue([
      {
        NextInvoiceOfNextInvoice: 'FV-HN000000000000123',
      },
    ]);
    const repo = new PaymentRepositoryImpl(
      { metodoPago: { findMany: jest.fn() } } as any,
      { executeInvoiceInsert } as any,
    );

    const result = await repo.processPayment({
      storeId: '1',
      posNo: 'POS01',
      shiftNumber: '5',
      customerNo: 'C-1',
      customerName: 'Cliente A',
      customerRtn: '0801',
      items: [
        {
          code: 'GAS',
          description: 'Gasolina',
          qty: 2,
          price: 100,
          tax: 30,
          discount: 0,
          total: 230,
        },
      ],
      payments: [
        { code: 1, description: 'EFECTIVO', amount: 230, isInvoice: true },
      ],
      total: 230,
      tax: 30,
      discount: 0,
    });

    expect(executeInvoiceInsert).toHaveBeenCalledTimes(1);
    const params = executeInvoiceInsert.mock.calls[0][0];
    expect(params).toMatchObject({
      storeId: '1',
      posNo: 'POS01',
      shiftNumber: '5',
      customerNo: 'C-1',
      customerRtn: '0801',
      total: 230,
      isTicket: false,
      isCredit: false,
    });
    expect(params.lines).toHaveLength(1);
    expect(params.lines[0]).toMatchObject({
      itemCode: 'GAS',
      description: 'Gasolina',
      quantity: 2,
      unitPrice: 100,
      vatAmount: 30,
      amountIncludingVAT: 230,
    });
    expect(params.payments).toHaveLength(1);
    expect(params.payments[0]).toMatchObject({
      code: 1,
      amount: 230,
      reference: '',
      description: 'EFECTIVO',
    });
    expect(result).toEqual({
      success: true,
      invoiceNo: 'FV-HN000000000000123',
    });
  });

  it('processPayment soporta items vacíos y referencia de pago', async () => {
    const executeInvoiceInsert = jest.fn().mockResolvedValue([]);
    const repo = new PaymentRepositoryImpl(
      { metodoPago: { findMany: jest.fn() } } as any,
      { executeInvoiceInsert } as any,
    );

    const result = await repo.processPayment({
      storeId: '2',
      posNo: 'POS02',
      shiftNumber: '1',
      customerNo: '',
      customerName: 'Consumidor Final',
      items: [],
      payments: [
        {
          code: 3,
          description: 'TARJETA',
          amount: 50,
          reference: 'XXXX-1234',
          isInvoice: true,
        },
      ],
      total: 50,
      tax: 0,
      discount: 0,
    });

    expect(result).toEqual({ success: true, invoiceNo: '' });
    expect(executeInvoiceInsert.mock.calls[0][0].payments[0]).toMatchObject({
      reference: 'XXXX-1234',
    });
  });

  it('processPayment aplica fallbacks con items parciales y sin payments', async () => {
    const executeInvoiceInsert = jest.fn().mockResolvedValue([]);
    const repo = new PaymentRepositoryImpl(
      { metodoPago: { findMany: jest.fn() } } as any,
      { executeInvoiceInsert } as any,
    );

    await repo.processPayment({
      storeId: '3',
      posNo: 'P',
      shiftNumber: '1',
      customerNo: '',
      customerName: '',
      items: [{ saleId: 5 }],
      total: 0,
      tax: 0,
      discount: 0,
    } as never);

    const params = executeInvoiceInsert.mock.calls[0][0];
    expect(params.lines[0]).toMatchObject({
      itemCode: '',
      quantity: 0,
      unitPrice: 0,
      saleId: 5,
    });
    expect(params.payments).toEqual([]);
  });
});

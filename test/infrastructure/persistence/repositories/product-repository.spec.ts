import { ProductRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/product-repository';

describe('ProductRepositoryImpl', () => {
  const priceRow = {
    codigoProducto: 'P1',
    precioUnitario: 29.21,
    fechaInicio: new Date('2020-01-01'),
    fechaFin: new Date('2100-01-01'),
  };
  const productRow = {
    codigo: 'P1',
    descripcion: 'Producto 1',
    codigoCategoria: 'CAT',
    grupoIsv: 'ISV_15',
  };

  it('getDefaultStoreId devuelve la primera tienda', async () => {
    const repo = new ProductRepositoryImpl({
      tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '001' }) },
    } as any);
    await expect(repo.getDefaultStoreId()).resolves.toBe('001');
  });

  it('findDiscount mapea el descuento activo', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      codigoCliente: 'C1',
      codigoProducto: 'P1',
      porcentaje: 10,
      rtnCliente: 'RTN',
      idTienda: '001',
      fechaInicio: new Date('2020-01-01'),
      fechaFin: new Date('2100-01-01'),
      montoPorGalon: null,
      montoPorLitro: null,
      precioReferencia: null,
      modoIngreso: null,
      activo: true,
    });
    const repo = new ProductRepositoryImpl({
      descuento: { findUnique },
    } as any);

    const discount = await repo.findDiscount('P1', 'C1');

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        codigoCliente_codigoProducto: {
          codigoCliente: 'C1',
          codigoProducto: 'P1',
        },
      },
    });
    expect(discount).not.toBeNull();
    expect(discount!.porcentaje).toBe(10);
  });

  it('findDiscount devuelve null si el descuento está inactivo', async () => {
    const repo = new ProductRepositoryImpl({
      descuento: {
        findUnique: jest.fn().mockResolvedValue({
          codigoCliente: 'C1',
          codigoProducto: 'P1',
          activo: false,
        }),
      },
    } as any);
    await expect(repo.findDiscount('P1', 'C1')).resolves.toBeNull();
  });

  it('calculateDiscount aplica porcentaje e ISV', async () => {
    const repo = new ProductRepositoryImpl({
      descuento: {
        findUnique: jest.fn().mockResolvedValue({
          codigoCliente: 'C1',
          codigoProducto: 'P1',
          porcentaje: 10,
          activo: true,
        }),
      },
    } as any);

    const result = await repo.calculateDiscount('P1', 'C1', 2, 'ISV_15', 100);

    expect(result.hasDiscount).toBe(true);
    expect(result.discountPercentage).toBe(10);
    // finalTotal = qty * unitPrice * (1 - 0.10) = 2 * 90 = 180
    expect(Number(result.finalTotal)).toBeCloseTo(180);
  });

  it('findAll devuelve productos con precio', async () => {
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '001' }) },
      precioProducto: { findMany: jest.fn().mockResolvedValue([priceRow]) },
      producto: { findMany: jest.fn().mockResolvedValue([productRow]) },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const products = await repo.findAll();

    expect(products).toHaveLength(1);
    expect(products[0].code).toBe('P1');
    expect(products[0].unitPrice).toBe(29.21);
    expect(products[0].vatGroup).toBe('ISV_15');
  });

  it('getDefaultStoreId cae a 001 si no hay tienda', async () => {
    const repo = new ProductRepositoryImpl({
      tienda: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);
    await expect(repo.getDefaultStoreId()).resolves.toBe('001');
  });

  it('findByCode encuentra el producto entre los activos', async () => {
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '001' }) },
      precioProducto: { findMany: jest.fn().mockResolvedValue([priceRow]) },
      producto: {
        findMany: jest
          .fn()
          .mockResolvedValue([productRow, { ...productRow, codigo: 'P2' }]),
      },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const found = await repo.findByCode('P2');
    const missing = await repo.findByCode('NOPE');

    expect(found?.code).toBe('P2');
    expect(missing).toBeNull();
  });

  it('getProductsFiltered excluye códigos de manguera y filtra por categoría', async () => {
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '001' }) },
      manguera: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ codigoPos: ' SUPER ' }, { codigoPos: null }]),
      },
      precioProducto: { findMany: jest.fn().mockResolvedValue([]) },
      producto: {
        findMany: jest.fn().mockResolvedValue([
          { ...productRow, codigo: 'super' },
          { ...productRow, codigo: 'GASEOSA', codigoCategoria: 'SNACK' },
        ]),
      },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const filtered = await repo.getProductsFiltered('SNACK', '001');

    expect(filtered.map((p) => p.code)).toEqual(['GASEOSA']);
  });

  it('getProductsAll excluye combustibles y usa el precio de precios_producto', async () => {
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '001' }) },
      manguera: {
        findMany: jest.fn().mockResolvedValue([{ codigoPos: 'SUPER' }]),
      },
      precioProducto: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ codigoProducto: 'AGUA', precioUnitario: 15 }]),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([
          { ...productRow, codigo: 'SUPER' },
          { ...productRow, codigo: 'AGUA' },
        ]),
      },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const all = await repo.getProductsAll('001');

    expect(all.map((p) => p.code)).toEqual(['AGUA']);
    expect(all[0].unitPrice).toBe(15);
  });

  it('queryProducts toma el primer precio y no aplica categoría en getAll', async () => {
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '001' }) },
      manguera: { findMany: jest.fn().mockResolvedValue([]) },
      precioProducto: {
        findMany: jest.fn().mockResolvedValue([
          { codigoProducto: 'P1', precioUnitario: 10 },
          { codigoProducto: 'P1', precioUnitario: 20 },
        ]),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([
          { ...productRow, codigo: 'P1', codigoCategoria: 'A' },
          { ...productRow, codigo: 'P2', codigoCategoria: 'B' },
        ]),
      },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const filtered = await repo.getProductsAll('001');

    expect(filtered.map((p) => p.code)).toEqual(['P1', 'P2']);
    expect(filtered[0].unitPrice).toBe(10);
  });

  it('findDiscount devuelve null si no hay descuento y mapea campos opcionales', async () => {
    const repo = new ProductRepositoryImpl({
      descuento: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);
    await expect(repo.findDiscount('P1', 'C1')).resolves.toBeNull();

    const full = new ProductRepositoryImpl({
      descuento: {
        findUnique: jest.fn().mockResolvedValue({
          codigoCliente: 'C1',
          codigoProducto: 'P1',
          porcentaje: 5,
          rtnCliente: 'RTN',
          idTienda: '001',
          fechaInicio: new Date('2020-01-01'),
          fechaFin: new Date('2100-01-01'),
          montoPorGalon: 0.5,
          montoPorLitro: null,
          precioReferencia: 30,
          modoIngreso: 'A',
          activo: true,
        }),
      },
    } as any);

    const discount = await full.findDiscount('P1', 'C1');
    expect(discount).toMatchObject({
      customerRTN: 'RTN',
      storeID: '001',
      amountPerGallon: 0.5,
      referenceUnitPrice: 30,
      entryMode: 'A',
    });
    expect(discount!.startingDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('calculateDiscount sin descuento aplica ISV_18 y hasDiscount false', async () => {
    const repo = new ProductRepositoryImpl({
      descuento: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    const result = await repo.calculateDiscount('P1', 'C1', 1, 'ISV_18', 118);

    expect(result.hasDiscount).toBe(false);
    expect(result.discountPercentage).toBe(0);
    // unitPriceWithoutIsv = 118 / 1.18 = 100
    expect(Number(result.unitPriceWithoutIsv)).toBeCloseTo(100);
    // finalTotal sin descuento = 118
    expect(Number(result.finalTotal)).toBeCloseTo(118);
    // totalDiscount = 0
    expect(Number(result.totalDiscount)).toBeCloseTo(0);
  });

  it('calculateDiscount ignora grupos sin ISV', async () => {
    const repo = new ProductRepositoryImpl({
      descuento: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    const result = await repo.calculateDiscount('P1', 'C1', 2, 'EXENTO', 50);

    expect(Number(result.unitPriceWithoutIsv)).toBeCloseTo(50);
    expect(Number(result.finalTotal)).toBeCloseTo(100);
  });

  it('calculateDiscount con 18% y descuento calcula isv unitario', async () => {
    const repo = new ProductRepositoryImpl({
      descuento: {
        findUnique: jest.fn().mockResolvedValue({
          codigoCliente: 'C1',
          codigoProducto: 'P1',
          porcentaje: 15,
          activo: true,
        }),
      },
    } as any);

    const result = await repo.calculateDiscount('P1', 'C1', 3, 'ISV_18', 118);

    expect(result.hasDiscount).toBe(true);
    expect(Number(result.unitPriceWithDiscount)).toBeCloseTo(100.3);
    expect(Number(result.isvAmountUnit)).toBeCloseTo(15.3, 1);
    expect(Number(result.totalWithoutIsv)).toBeCloseTo(300);
    expect(Number(result.totalDiscount)).toBeCloseTo(53.1, 1);
  });
});

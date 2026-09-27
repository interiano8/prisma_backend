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

  it('listCategories cuenta productos por categoría y titula las que faltan', async () => {
    const prisma = {
      categoriaProducto: {
        findMany: jest.fn().mockResolvedValue([
          { codigo: 'CAT_A', descripcion: 'Cat A' },
          { codigo: 'CAT_B', descripcion: null },
        ]),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([
          { codigoCategoria: 'CAT_A' },
          { codigoCategoria: 'CAT_A' },
          { codigoCategoria: null },
          { codigoCategoria: 'CAT_B' },
        ]),
      },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const result = await repo.listCategories();

    expect(result).toEqual([
      { codigo: 'CAT_A', descripcion: 'Cat A', count: 2 },
      { codigo: 'CAT_B', descripcion: 'Cat B', count: 1 },
    ]);
  });

  it('findApplicableDiscountRules consulta y mapea las reglas activas', async () => {
    const prisma = {
      reglaDescuento: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'R1',
            codigoCliente: null,
            codigoProducto: null,
            codigoCategoria: null,
            cantidadMinima: 5,
            tipoBeneficio: 'PORCENTAJE',
            valor: '10',
            unidadVolumen: null,
            prioridad: 1,
          },
        ]),
      },
    } as any;
    const repo = new ProductRepositoryImpl(prisma);

    const rules = await repo.findApplicableDiscountRules('C1', 'P1', 'CAT');

    expect(rules[0]).toEqual({
      id: 'R1',
      codigoCliente: undefined,
      codigoProducto: undefined,
      codigoCategoria: undefined,
      cantidadMinima: 5,
      tipoBeneficio: 'PORCENTAJE',
      valor: 10,
      unidadVolumen: undefined,
      prioridad: 1,
      acumulable: false,
    });
    expect(prisma.reglaDescuento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activo: true, AND: expect.any(Array) } }),
    );
  });
});

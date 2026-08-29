import { CustomerRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/customer-repository';

describe('CustomerRepositoryImpl', () => {
  const customerRow = {
    codigo: 'C001',
    nombre: 'Cliente Uno',
    rtn: '0801...',
    telefono: '9999',
    correo: 'c@x.com',
    direccion: 'Roatan',
    bloqueado: false,
    tipoFacturacion: 1,
    fechaActualizacion: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('search devuelve clientes mapeados', async () => {
    const findMany = jest.fn().mockResolvedValue([customerRow]);
    const repo = new CustomerRepositoryImpl({ cliente: { findMany } } as any);

    const customers = await repo.search('cliente');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
    expect(customers).toHaveLength(1);
    expect(customers[0].code).toBe('C001');
    expect(customers[0].blocked).toBe(false);
  });

  it('search con creditOnly filtra por tipoFacturacion 0', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repo = new CustomerRepositoryImpl({ cliente: { findMany } } as any);

    await repo.search(undefined, true);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoFacturacion: 0 }),
      }),
    );
  });

  it('findByCode devuelve null si no existe', async () => {
    const repo = new CustomerRepositoryImpl({
      cliente: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);
    await expect(repo.findByCode('X')).resolves.toBeNull();
  });

  it('createCustomer permite RTN repetido (upsert directo)', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const repo = new CustomerRepositoryImpl({ cliente: { upsert } } as any);

    const result = await repo.createCustomer('C', 'N', '0801...');

    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });

  it('createCustomer crea el cliente si no existe', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const upsert = jest.fn().mockResolvedValue({});
    const repo = new CustomerRepositoryImpl({
      cliente: { findFirst, upsert },
    } as any);

    const result = await repo.createCustomer('C', 'N', 'RTN');

    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });

  it('getConsumidorFinalCode devuelve el código de la tienda', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ codigoConsumidorFinal: 'CF' });
    const repo = new CustomerRepositoryImpl({ tienda: { findFirst } } as any);

    await expect(repo.getConsumidorFinalCode()).resolves.toBe('CF');
  });

  it('findByRtn devuelve el cliente mapeado o null', async () => {
    const found = new CustomerRepositoryImpl({
      cliente: { findFirst: jest.fn().mockResolvedValue(customerRow) },
    } as any);
    const missing = new CustomerRepositoryImpl({
      cliente: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(found.findByRtn('0801')).resolves.toMatchObject({
      code: 'C001',
    });
    await expect(missing.findByRtn('0801')).resolves.toBeNull();
  });

  it('findByCode devuelve el cliente mapeado si existe', async () => {
    const repo = new CustomerRepositoryImpl({
      cliente: { findUnique: jest.fn().mockResolvedValue(customerRow) },
    } as any);

    await expect(repo.findByCode('C001')).resolves.toMatchObject({
      name: 'Cliente Uno',
    });
  });

  it('getConsumidorFinalCode devuelve null si no hay tienda o código', async () => {
    const noStore = new CustomerRepositoryImpl({
      tienda: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);
    const noCode = new CustomerRepositoryImpl({
      tienda: { findFirst: jest.fn().mockResolvedValue({}) },
    } as any);

    await expect(noStore.getConsumidorFinalCode()).resolves.toBeNull();
    await expect(noCode.getConsumidorFinalCode()).resolves.toBeNull();
  });

  it('mapea campos opcionales con fallbacks', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        codigo: 'C002',
        nombre: null,
        rtn: null,
        telefono: null,
        correo: null,
        direccion: null,
        bloqueado: true,
        tipoFacturacion: null,
        fechaActualizacion: null,
      },
    ]);
    const repo = new CustomerRepositoryImpl({ cliente: { findMany } } as any);

    const result = await repo.search();
    const list = Array.isArray(result) ? result : result.data;
    const [c] = list;

    expect(c.name).toBe('');
    expect(c.rtf).toBe('');
    expect(c.blocked).toBe(true);
    expect(c.billingType).toBeUndefined();
    expect(c.dateUpdate).toBeUndefined();
  });
});

import { SorteosService } from '../../src/application/services/sorteos.service';
import type { SorteosRepository } from '../../src/domain/ports/out/sorteos-repository.interface';

describe('SorteosService', () => {
  let service: SorteosService;
  let mockRepo: jest.Mocked<SorteosRepository>;

  const params = {
    storeId: '001',
    posNo: '01',
    posTransactionId: 'TX-000123',
    total: 1000,
    items: [{ code: 'FUEL001', discount: 0, total: 1000 }],
    isCredit: false,
    payments: [{ method: 'EFECTIVO', code: '01', amount: 1000 }],
    customerNo: 'CF',
  };

  beforeEach(() => {
    mockRepo = {
      getActiveSorteos: jest.fn(),
      getFuelCodes: jest.fn(),
      getItemCategories: jest.fn(),
      getSorteoConditions: jest.fn(),
      saveWonSorteo: jest.fn(),
    };
    service = new SorteosService(mockRepo);
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  it('devuelve [] cuando no hay sorteos activos', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([]);

    expect(await service.evaluateSorteos(params)).toEqual([]);
    expect(mockRepo.saveWonSorteo).not.toHaveBeenCalled();
  });

  it('gana un sorteo por monto mínimo y lo guarda', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 1, Nombre: 'Gran Sorteo', TextoTicket: 'TKT1' },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue(['FUEL001']);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'MONTOFACTURA',
        ValorRequerido: '500',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);
    mockRepo.saveWonSorteo.mockResolvedValue(undefined);

    const result = await service.evaluateSorteos(params);

    expect(mockRepo.saveWonSorteo).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].sorteoId).toBe(1);
    expect(result[0].correlativo).toMatch(/^001011-/);
  });

  it('no gana si no cumple el monto mínimo', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 1, Nombre: 'Gran Sorteo', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'MONTOFACTURA',
        ValorRequerido: '9999',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos(params);

    expect(result).toEqual([]);
    expect(mockRepo.saveWonSorteo).not.toHaveBeenCalled();
  });

  it('evalúa condición de categoría de combustibles', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 2, Nombre: 'Combustible', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue(['FUEL001']);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'CATEGORIA',
        ValorRequerido: '',
        ValorTexto: 'COMBUSTIBLES',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos(params);

    expect(result).toHaveLength(1);
  });

  it('evalúa SIN_DESCUENTO (falla si algún item tiene descuento)', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 3, Nombre: 'Sin descuento', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'SIN_DESCUENTO',
        ValorRequerido: '',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos({
      ...params,
      items: [{ code: 'P1', discount: 5, total: 100 }],
    });

    expect(result).toEqual([]);
  });

  it('captura errores del repositorio y devuelve []', async () => {
    mockRepo.getActiveSorteos.mockRejectedValue(new Error('db down'));

    expect(await service.evaluateSorteos(params)).toEqual([]);
  });

  it('evalúa categoría específica a partir del mapa de categorías', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 4, Nombre: 'Lubricantes', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([
      { No_: 'p1', 'Item Category Code': 'lubricantes' },
    ]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'CATEGORIA',
        ValorRequerido: '',
        ValorTexto: 'LUBRICANTES',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos({
      ...params,
      items: [{ code: 'P1', discount: 0, total: 100 }],
    });

    expect(result).toHaveLength(1);
  });

  it('no gana si la categoría del item no coincide', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 5, Nombre: 'Otros', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'CATEGORIA',
        ValorRequerido: '',
        ValorTexto: 'LUBRICANTES',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos({
      ...params,
      items: [{ code: 'P1', discount: 0, total: 100 }],
    });

    expect(result).toEqual([]);
  });

  it('evalúa TIPO_CLIENTE para crédito y contado', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 6, Nombre: 'Cliente', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'TIPO_CLIENTE',
        ValorRequerido: '',
        ValorTexto: 'CREDITO',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const credit = await service.evaluateSorteos({
      ...params,
      isCredit: true,
    });
    const contado = await service.evaluateSorteos({
      ...params,
      isCredit: false,
    });

    expect(credit).toHaveLength(1);
    expect(contado).toEqual([]);
  });

  it('evalúa SIN_ACUMULAR_PUNTOS con pago Leal', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 7, Nombre: 'Sin Leal', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'SIN_ACUMULAR_PUNTOS',
        ValorRequerido: '',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const withLeal = await service.evaluateSorteos({
      ...params,
      payments: [{ method: 'LEAL', code: 'LEAL', amount: 1000 }],
    });
    const sinLeal = await service.evaluateSorteos(params);

    expect(withLeal).toEqual([]);
    expect(sinLeal).toHaveLength(1);
  });

  it('da por cumplida una condición de tipo desconocido', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 8, Nombre: 'Tipo raro', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'OTRO_TIPO',
        ValorRequerido: '',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos(params);

    expect(result).toHaveLength(1);
  });

  it('usa ValorMonto cuando MONTO_MINIMO trae monto numérico', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 9, Nombre: 'Monto mínimo', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([
      {
        TipoEvaluacion: 'MONTO_MINIMO',
        ValorRequerido: '0',
        ValorTexto: '',
        ValorMonto: 500,
        ValorCantidad: 0,
        Operador: '',
      },
    ]);

    const result = await service.evaluateSorteos(params);

    expect(result).toHaveLength(1);
  });

  it('genera correlativo con storeId no numérico', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 1, Nombre: 'Sorteo', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([]);

    const result = await service.evaluateSorteos({
      ...params,
      storeId: 'ABC',
    });

    expect(result).toHaveLength(1);
    expect(result[0].correlativo).toMatch(/^001011-/);
  });

  it('genera correlativo aleatorio cuando la transacción no tiene dígitos', async () => {
    mockRepo.getActiveSorteos.mockResolvedValue([
      { SorteoID: 1, Nombre: 'Sorteo', TextoTicket: null },
    ]);
    mockRepo.getFuelCodes.mockResolvedValue([]);
    mockRepo.getItemCategories.mockResolvedValue([]);
    mockRepo.getSorteoConditions.mockResolvedValue([]);

    const result = await service.evaluateSorteos({
      ...params,
      posTransactionId: 'TX-ABC',
    });

    expect(result).toHaveLength(1);
    expect(result[0].correlativo).toMatch(/^001011-[A-Z0-9]{7}$/);
  });
});

import { CampanasService } from '../../src/application/services/campanas.service';
import type { CampanasRepository } from '../../src/domain/ports/out/campanas-repository.interface';

describe('CampanasService', () => {
  let service: CampanasService;
  let mockRepo: jest.Mocked<CampanasRepository>;

  const baseParams = {
    storeId: '001',
    posNo: '01',
    posTransactionId: 'TX-000123',
    total: 1000,
    items: [{ code: 'FUEL001', discount: 0, total: 1000, quantity: 2 }],
    isCredit: false,
    payments: [{ method: 'EFECTIVO', code: '01', amount: 1000 }],
    customerNo: 'C01',
  };

  beforeEach(() => {
    mockRepo = {
      getActiveCampanas: jest.fn(),
      getCampanaConditions: jest.fn(),
      getItemCategories: jest.fn(),
      countParticipaciones: jest.fn(),
      saveParticipacion: jest.fn(),
      getTicketByCorrelativo: jest.fn(),
      listCampanas: jest.fn(),
      createCampana: jest.fn(),
      updateCampana: jest.fn(),
      deleteCampana: jest.fn(),
      createCondicion: jest.fn(),
      updateCondicion: jest.fn(),
      deleteCondicion: jest.fn(),
    };
    service = new CampanasService(mockRepo);
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  it('devuelve [] cuando no hay campañas activas', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([]);
    expect(await service.evaluateCampanas(baseParams)).toEqual([]);
    expect(mockRepo.saveParticipacion).not.toHaveBeenCalled();
  });

  it('modo ALL: exige todas las condiciones', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 1,
        Nombre: 'Campana ALL',
        TextoTicket: 'TKT1',
        ModoEvaluacion: 'ALL',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'TOTAL_FACTURA',
        Operador: 'GTE',
        ValorTexto: '',
        ValorMonto: 500,
        ValorCantidad: 0,
      },
      {
        id: 1,
        TipoEvaluacion: 'SIN_DESCUENTO',
        Operador: 'EQ',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 0,
      },
    ]);
    const ok = await service.evaluateCampanas(baseParams);
    expect(ok).toHaveLength(1);

    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'TOTAL_FACTURA',
        Operador: 'GTE',
        ValorTexto: '',
        ValorMonto: 2000,
        ValorCantidad: 0,
      },
    ]);
    const no = await service.evaluateCampanas(baseParams);
    expect(no).toEqual([]);
  });

  it('modo ANY: basta una condición', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 2,
        Nombre: 'Campana ANY',
        TextoTicket: null,
        ModoEvaluacion: 'ANY',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'TOTAL_FACTURA',
        Operador: 'GTE',
        ValorTexto: '',
        ValorMonto: 5000,
        ValorCantidad: 0,
      },
      {
        id: 1,
        TipoEvaluacion: 'CATEGORIA',
        Operador: 'EQ',
        ValorTexto: 'COMBUSTIBLES',
        ValorMonto: 0,
        ValorCantidad: 0,
      },
    ]);
    mockRepo.getItemCategories.mockResolvedValue([
      { No_: 'FUEL001', 'Item Category Code': 'COMBUSTIBLES' },
    ]);
    const result = await service.evaluateCampanas(baseParams);
    expect(result).toHaveLength(1);
  });

  it('CANTIDAD_ITEM usa valorCantidad y el máximo por línea', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 3,
        Nombre: 'Cantidad',
        TextoTicket: null,
        ModoEvaluacion: 'ALL',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'CANTIDAD_ITEM',
        Operador: 'GTE',
        ValorTexto: '',
        ValorMonto: 0,
        ValorCantidad: 10,
      },
    ]);
    const low = await service.evaluateCampanas({
      ...baseParams,
      items: [{ code: 'FUEL001', discount: 0, total: 1000, quantity: 5 }],
    });
    expect(low).toEqual([]);

    const high = await service.evaluateCampanas({
      ...baseParams,
      items: [{ code: 'FUEL001', discount: 0, total: 1000, quantity: 12 }],
    });
    expect(high).toHaveLength(1);
  });

  it('TIPO_CLIENTE distingue crédito/contado', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 4,
        Nombre: 'Solo credito',
        TextoTicket: null,
        ModoEvaluacion: 'ALL',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'TIPO_CLIENTE',
        Operador: 'EQ',
        ValorTexto: 'CREDITO',
        ValorMonto: 0,
        ValorCantidad: 0,
      },
    ]);
    const credit = await service.evaluateCampanas({
      ...baseParams,
      isCredit: true,
    });
    expect(credit).toHaveLength(1);
    const cash = await service.evaluateCampanas(baseParams);
    expect(cash).toEqual([]);
  });

  it('SIN_ACUMULAR_PUNTOS excluye pagos Leal', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 5,
        Nombre: 'Sin puntos',
        TextoTicket: null,
        ModoEvaluacion: 'ALL',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'SIN_ACUMULAR_PUNTOS',
        Operador: 'EQ',
        ValorTexto: 'FALSE',
        ValorMonto: 0,
        ValorCantidad: 0,
      },
    ]);
    const withLeal = await service.evaluateCampanas({
      ...baseParams,
      payments: [{ method: 'LEAL', code: 'LEAL', amount: 100 }],
    });
    expect(withLeal).toEqual([]);
    const sinLeal = await service.evaluateCampanas(baseParams);
    expect(sinLeal).toHaveLength(1);
  });

  it('fail-closed: tipo u operador desconocido no otorga participación', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 6,
        Nombre: 'Rara',
        TextoTicket: null,
        ModoEvaluacion: 'ALL',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      {
        id: 1,
        TipoEvaluacion: 'TIPO_INEXISTENTE',
        Operador: 'EQ',
        ValorTexto: 'X',
        ValorMonto: 0,
        ValorCantidad: 0,
      },
    ]);
    const result = await service.evaluateCampanas(baseParams);
    expect(result).toEqual([]);
  });

  it('límite por cliente: sin cliente no participa y límite alcanzado no emite', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 7,
        Nombre: 'Limitada',
        TextoTicket: null,
        ModoEvaluacion: 'ALL',
        LimitePorCliente: 3,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([]);
    mockRepo.countParticipaciones.mockResolvedValue(3);

    const sinCliente = await service.evaluateCampanas({
      ...baseParams,
      customerNo: '',
    });
    expect(sinCliente).toEqual([]);

    const alcanzado = await service.evaluateCampanas(baseParams);
    expect(alcanzado).toEqual([]);
    expect(mockRepo.countParticipaciones).toHaveBeenCalledWith(7, 'C01', undefined);

    mockRepo.countParticipaciones.mockResolvedValue(2);
    const emite = await service.evaluateCampanas(baseParams);
    expect(emite).toHaveLength(1);
  });

  it('límite NULL = ilimitado', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      {
        CampanaID: 8,
        Nombre: 'Ilimitada',
        TextoTicket: null,
        ModoEvaluacion: 'ALL',
        LimitePorCliente: null,
      },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([]);
    const result = await service.evaluateCampanas(baseParams);
    expect(result).toHaveLength(1);
    expect(mockRepo.countParticipaciones).not.toHaveBeenCalled();
  });

it('errores de repo devuelven []', async () => {
    mockRepo.getActiveCampanas.mockRejectedValue(new Error('db'));
    expect(await service.evaluateCampanas(baseParams)).toEqual([]);
  });

  it('CATEGORIA compara la categoría del ítem (EQ y CONTAINS)', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      { CampanaID: 4, Nombre: 'Cat', TextoTicket: null, ModoEvaluacion: 'ALL', LimitePorCliente: null },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      { id: 1, TipoEvaluacion: 'CATEGORIA', Operador: 'EQ', ValorTexto: 'GASOLINA', ValorMonto: 0, ValorCantidad: 0 },
    ]);
    mockRepo.getItemCategories.mockResolvedValue([
      { No_: 'FUEL001', 'Item Category Code': 'GASOLINA' },
    ]);

    const ok = await service.evaluateCampanas(baseParams);
    expect(ok).toHaveLength(1);

    mockRepo.getCampanaConditions.mockResolvedValue([
      { id: 1, TipoEvaluacion: 'CATEGORIA', Operador: 'EQ', ValorTexto: 'DIESEL', ValorMonto: 0, ValorCantidad: 0 },
    ]);
    expect(await service.evaluateCampanas(baseParams)).toEqual([]);
  });

  it('SIN_DESCUENTO compara si la venta llevó descuento', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      { CampanaID: 5, Nombre: 'SinDesc', TextoTicket: null, ModoEvaluacion: 'ALL', LimitePorCliente: null },
    ]);
    mockRepo.getCampanaConditions.mockResolvedValue([
      { id: 1, TipoEvaluacion: 'SIN_DESCUENTO', Operador: 'EQ', ValorTexto: 'FALSE', ValorMonto: 0, ValorCantidad: 0 },
    ]);

    expect(await service.evaluateCampanas(baseParams)).toHaveLength(1);
    const withDesc = await service.evaluateCampanas({
      ...baseParams,
      items: [{ code: 'FUEL001', discount: 10, total: 1000, quantity: 2 }],
    });
    expect(withDesc).toEqual([]);
  });

  it('TIPO_CLIENTE con op CONTAINS e IN', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      { CampanaID: 6, Nombre: 'Cliente', TextoTicket: null, ModoEvaluacion: 'ALL', LimitePorCliente: null },
    ]);

    mockRepo.getCampanaConditions.mockResolvedValue([
      { id: 1, TipoEvaluacion: 'TIPO_CLIENTE', Operador: 'CONTAINS', ValorTexto: 'CONTA', ValorMonto: 0, ValorCantidad: 0 },
    ]);
    expect(await service.evaluateCampanas(baseParams)).toHaveLength(1);

    mockRepo.getCampanaConditions.mockResolvedValue([
      { id: 1, TipoEvaluacion: 'TIPO_CLIENTE', Operador: 'IN', ValorTexto: 'CREDITO,CONTADO', ValorMonto: 0, ValorCantidad: 0 },
    ]);
    expect(await service.evaluateCampanas(baseParams)).toHaveLength(1);

    mockRepo.getCampanaConditions.mockResolvedValue([
      { id: 1, TipoEvaluacion: 'TIPO_CLIENTE', Operador: 'NEQ', ValorTexto: 'CREDITO', ValorMonto: 0, ValorCantidad: 0 },
    ]);
    expect(await service.evaluateCampanas(baseParams)).toHaveLength(1);
  });
  it('operadores de comparación numérica y de lista', async () => {
    mockRepo.getActiveCampanas.mockResolvedValue([
      { CampanaID: 7, Nombre: 'Ops', TextoTicket: null, ModoEvaluacion: 'ALL', LimitePorCliente: null },
    ]);
    mockRepo.getItemCategories.mockResolvedValue([
      { No_: 'FUEL001', 'Item Category Code': 'GASOLINA' },
    ]);

    const cases: [string, string, any][] = [
      ['CANTIDAD_ITEM', 'EQ', { ValorCantidad: 2 }],
      ['CANTIDAD_ITEM', 'LTE', { ValorCantidad: 3 }],
      ['CANTIDAD_ITEM', 'NEQ', { ValorCantidad: 5 }],
      ['TOTAL_FACTURA', 'LTE', { ValorMonto: 2000 }],
      ['TOTAL_FACTURA', 'NEQ', { ValorMonto: 999 }],
      ['CATEGORIA', 'CONTAINS', { ValorTexto: 'GASO' }],
      ['CATEGORIA', 'IN', { ValorTexto: 'DIESEL,GASOLINA' }],
      ['CATEGORIA', 'NEQ', { ValorTexto: 'DIESEL' }],
    ];

    for (const [tipo, op, extra] of cases) {
      mockRepo.getCampanaConditions.mockResolvedValue([
        { id: 1, TipoEvaluacion: tipo, Operador: op, ValorTexto: extra.ValorTexto ?? '', ValorMonto: extra.ValorMonto ?? 0, ValorCantidad: extra.ValorCantidad ?? 0 },
      ]);
      const res = await service.evaluateCampanas(baseParams);
      expect(res).toHaveLength(1);
    }
  });
});

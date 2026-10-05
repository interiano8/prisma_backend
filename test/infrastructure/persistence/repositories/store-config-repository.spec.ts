import { StoreConfigRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/store-config-repository';

describe('StoreConfigRepositoryImpl', () => {
  const tiendaRow = {
    idTienda: '001',
    nombre: 'RECREO',
    casaMatriz: 'RECREO',
    rtn: '06019995197170',
    telefono: '2782-0695',
    correo: 'test@x.com',
    direccion1: 'Roatan',
    direccion2: null,
    direccion3: null,
    pais: 'HN',
    estado: 'AT',
    ciudad: 'Roatan',
    contrasenaAdmin: 'admin',
    turnos: 99,
    d3: null,
    d4: null,
    transaccionesPendientes: null,
    urlLeal: 'https://leal',
    lealHabilitado: true,
    codigoPais: '504',
    esControladorGas: true,
    avisoNuevosRangosFactura: null,
    avisoNuevosRangosNotaCredito: null,
    fusionAsignado: true,
    ipFusion: '1.1.1.1',
  urlControlador: 'http://fusion',
    variasLineasPermitidas: true,
    descuentosPermitidos: true,
    bloqueadoTransaccionesPendientes: false,
    modoDepuracion: false,
    claveControlador: 'k',
    codigoConsumidorFinal: 'CF',
    urlSaldo: '',
    validarRfid: true,
    validarSaldoCredito: false,
    voxActivo: false,
    rangoIndividual: true,
    facturacionOrdenada: true,
    erp: '',
    urlActualizacion: '',
    urlBaseErp: '',
    turnoManual: true,
    calculoInverso: true,
    bloqueadoTransaccionesBomba: false,
    bloqueadoTransaccionesTurno: false,
    campanas: true,
    declararMontoInicial: false,
  };

  it('findByStoreId mapea la tienda al StoreConfig', async () => {
    const findUnique = jest.fn().mockResolvedValue(tiendaRow);
    const repo = new StoreConfigRepositoryImpl({
      tienda: { findUnique },
    } as any);

    const config = await repo.findByStoreId('001');

    expect(findUnique).toHaveBeenCalledWith({ where: { idTienda: '001' } });
    expect(config).not.toBeNull();
    expect(config!.storeId).toBe('001');
    expect(config!.rtn).toBe('06019995197170');
    expect(config!.campanas).toBe(true);
  });

  it('findByStoreId devuelve null si no existe', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.findByStoreId('999')).resolves.toBeNull();
  });

  it('findBlockedForPendingTransactions refleja el flag', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ bloqueadoTransaccionesPendientes: true }),
      },
    } as any);

    await expect(repo.findBlockedForPendingTransactions('001')).resolves.toBe(
      true,
    );
  });

  it('findHideShiftInfo lee configuracion_pos', async () => {
    const repo = new StoreConfigRepositoryImpl({
      configuracionPos: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ocultarInformacionTurnos: true }),
      },
    } as any);

    await expect(repo.findHideShiftInfo('01')).resolves.toBe(true);
  });

  it('findExchangeRate devuelve la tasa', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tasaCambio: { findFirst: jest.fn().mockResolvedValue({ tasa: 24.5 }) },
    } as any);

    await expect(repo.findExchangeRate('2026-08-15')).resolves.toBe(24.5);
  });

  it('findBlockedForPendingTransactions devuelve false ante error', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: { findUnique: jest.fn().mockRejectedValue(new Error('db')) },
    } as any);

    await expect(repo.findBlockedForPendingTransactions('001')).resolves.toBe(
      false,
    );
  });

  it('findBlockedForPendingTransactions devuelve false si no hay fila', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.findBlockedForPendingTransactions('001')).resolves.toBe(
      false,
    );
  });

  it('findHideShiftInfo devuelve false ante error', async () => {
    const repo = new StoreConfigRepositoryImpl({
      configuracionPos: {
        findUnique: jest.fn().mockRejectedValue(new Error('db')),
      },
    } as any);

    await expect(repo.findHideShiftInfo('01')).resolves.toBe(false);
  });

  it('findExchangeRate devuelve 0 ante error o fila nula', async () => {
    const failing = new StoreConfigRepositoryImpl({
      tasaCambio: { findFirst: jest.fn().mockRejectedValue(new Error('db')) },
    } as any);
    const empty = new StoreConfigRepositoryImpl({
      tasaCambio: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(failing.findExchangeRate('2026-08-15')).resolves.toBe(0);
    await expect(empty.findExchangeRate('2026-08-15')).resolves.toBe(0);
  });

  it('update lanza error si la tienda no existe', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.update('999', {})).rejects.toThrow('Store 999 not found');
  });

  it('update devuelve la tienda existente', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(tiendaRow) },
    } as any);

    await expect(repo.update('001', { storeName: 'X' })).resolves.toMatchObject(
      {
        storeId: '001',
      },
    );
  });

  it('mapea d3/d4 numéricos a string y usa fallback de casaMatriz', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: {
        findUnique: jest.fn().mockResolvedValue({
          ...tiendaRow,
          nombre: '',
          casaMatriz: 'TITULO CAIDA',
          nombreBotonFidelizacion: null,
        }),
      },
    } as any);

    const config = await repo.findByStoreId('001');

    expect(config!.storeName).toBe('TITULO CAIDA');
    expect(config!.nombreBotonFidelizacion).toBe('LEAL');
  });

  it('mapStoreConfig aplica fallbacks con tienda vacía', async () => {
    const repo = new StoreConfigRepositoryImpl({
      tienda: {
        findUnique: jest.fn().mockResolvedValue({ idTienda: '002' }),
      },
    } as any);

    const config = await repo.findByStoreId('002');

    expect(config).toMatchObject({
      storeId: '002',
      storeName: '',
      rtf: '',
      phone: '',
      email: '',
      address: '',
      isGasController: false,
      ipFusionController: '',
      isLealEnabled: false,
      urlLeal: '',
      passAdmin: '',
      turnos: null,
      d3: '',
      d4: '',
      numberOfTransactionsWaiting: null,
      codeCountry: '',
      warningNewInvoiceRanges: null,
      warningNewCreditNotesRanges: null,
  urlControlador: '',
      blockedForPendingTransactions: false,
      debugMode: false,
      noConsumidorFinal: '',
      urlSaldo: '',
      validarRFID: false,
      validarSaldoCredito: true,
      voxIsActive: false,
      rangoIndividual: false,
      facturacionOrdenada: false,
      erp: '',
      turnoManual: false,
      calculoInverso: false,
      campanas: false,
    });
  });
});

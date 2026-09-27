import { StoreBootstrapService } from '../src/application/services/store-bootstrap.service';

describe('E2E Store Provisioning Flow (Matriz -> POS Local)', () => {
  let service: StoreBootstrapService;
  let inMemoryDb: {
    tiendas: Map<string, any>;
    configuracionPos: Map<string, any>;
    mangueras: Map<number, any>;
    configuracionTienda: Map<string, any>;
    seriesDocumento: Map<string, any>;
    monedas: Map<string, any>;
  };
  let prismaMock: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.BACKOFFICE_SYNC_URL = 'https://backoffice.internal/api/sync';
    process.env.BACKOFFICE_SYNC_KEY = 'prisma-cloud-sync-key';
    process.env.STORE_CODE = '002';

    inMemoryDb = {
      tiendas: new Map(),
      configuracionPos: new Map(),
      mangueras: new Map(),
      configuracionTienda: new Map(),
      seriesDocumento: new Map(),
      monedas: new Map([
        ['HNL', { codigo: 'HNL', descripcion: 'Lempiras', simbolo: 'L.', activa: true }],
      ]),
    };

    // Pre-población de Series Fiscales SAR locales (CAI y correlativos activos de la estación)
    inMemoryDb.seriesDocumento.set('1-FV-HN', {
      numeroLinea: 1,
      codigoSerie: 'FV-HN',
      idTienda: '002',
      codigoPos: '01',
      cai: '3A1B2C-4D5E6F-7A8B9C-0D1E2F-3A4B5C-6D',
      rangoDesde: '001-001-01-00000001',
      rangoHasta: '001-001-01-00050000',
      ultimoNumeroUsado: '001-001-01-00001245',
      fechaVenceRango: new Date('2027-12-31'),
    });
    inMemoryDb.seriesDocumento.set('2-NC-HN', {
      numeroLinea: 2,
      codigoSerie: 'NC-HN',
      idTienda: '002',
      codigoPos: '01',
      cai: '7F8E9D-0C1B2A-3F4E5D-6C7B8A-9F0E1D-2C',
      rangoDesde: '001-001-04-00000001',
      rangoHasta: '001-001-04-00010000',
      ultimoNumeroUsado: '001-001-04-00000012',
      fechaVenceRango: new Date('2027-12-31'),
    });

    const createTx = () => ({
      moneda: {
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          const key = where.codigo;
          const curr = inMemoryDb.monedas.get(key) || create;
          const merged = { ...curr, ...update };
          inMemoryDb.monedas.set(key, merged);
          return Promise.resolve(merged);
        }),
      },
      tienda: {
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          const key = where.idTienda;
          const curr = inMemoryDb.tiendas.get(key);
          const merged = curr ? { ...curr, ...update } : { ...create };
          inMemoryDb.tiendas.set(key, merged);
          return Promise.resolve(merged);
        }),
      },
      configuracionPos: {
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          const key = where.codigoPos;
          const curr = inMemoryDb.configuracionPos.get(key);
          const merged = curr ? { ...curr, ...update } : { ...create };
          inMemoryDb.configuracionPos.set(key, merged);
          return Promise.resolve(merged);
        }),
      },
      manguera: {
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          const key = where.idManguera;
          const curr = inMemoryDb.mangueras.get(key);
          const merged = curr ? { ...curr, ...update } : { ...create };
          inMemoryDb.mangueras.set(key, merged);
          return Promise.resolve(merged);
        }),
      },
      configuracionTienda: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(inMemoryDb.configuracionTienda.get(where.idTienda) || null);
        }),
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          const key = where.idTienda;
          const curr = inMemoryDb.configuracionTienda.get(key);
          const merged = curr ? { ...curr, ...update } : { ...create };
          inMemoryDb.configuracionTienda.set(key, merged);
          return Promise.resolve(merged);
        }),
      },
      serieDocumento: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(inMemoryDb.seriesDocumento.values()))),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    });

    prismaMock = {
      configuracionTienda: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(inMemoryDb.configuracionTienda.get(where.idTienda) || null);
        }),
      },
      serieDocumento: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(inMemoryDb.seriesDocumento.values()))),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: (tx: any) => Promise<any>) => {
        return cb(createTx());
      }),
    };

    service = new StoreBootstrapService(prismaMock);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BACKOFFICE_SYNC_URL;
    delete process.env.BACKOFFICE_SYNC_KEY;
    delete process.env.STORE_CODE;
    jest.restoreAllMocks();
  });

  it('Paso 1: Aprovisionamiento inicial de Store 002 desde Matriz y protección estricta de Series SAR', async () => {
    // 1. Snapshot simulado que retorna la Matriz para Store 002
    const remoteSnapshotV1 = {
      storeCode: '002',
      configVersion: 1,
      tienda: {
        nombre: 'ESTACIÓN EL TREBOL 002',
        rtn: '08011999888888',
        emisor: 'INVERSIONES EL TREBOL S.A.',
        titulo: 'Gasolinera El Trebol #2',
        direccion1: 'Boulevard del Norte, San Pedro Sula',
        telefono: '+504 2555-1234',
        correo: 'trebol@gasolinera.hn',
        ipFusion: '192.168.10.150',
        urlControlador: 'http://192.168.10.150:5008',
        claveControlador: 'trebol-secure-key',
        esControladorGas: false,
        moneda: 'HNL',
        codigoMoneda: 'HNL',
        variasLineasPermitidas: true,
        descuentosPermitidos: true,
      },
      configuracionPos: {
        codigoPos: '01',
        pantallaEnBomba: true,
        bloquearSoloPos: true,
        mostrarVideoPublicidad: false,
        reimprimirVarios: true,
        facturarVariasLineas: true,
        descuentoManual: true,
        mostrarBombas: true,
        numTransaccionesBombas: 450,
        minutosAtrasada: 45,
        mostrarTeclado: true,
        declararMontosIniciales: true,
      },
      mangueras: [
        {
          idManguera: 1,
          idBomba: 1,
          idMangueraFisica: 1,
          numeroGrado: 1,
          nombreGrado: 'SUPER',
          precioUnitario: 132.8,
          idsTanques: '1',
          pos: '1',
          codigoPos: '1',
          codigoGenerico: '1',
          visible: true,
          unidadMedida: 'GL',
          codigoMoneda: 'HNL',
        },
        {
          idManguera: 2,
          idBomba: 1,
          idMangueraFisica: 2,
          numeroGrado: 2,
          nombreGrado: 'REGULAR',
          precioUnitario: 118.5,
          idsTanques: '2',
          pos: '1',
          codigoPos: '1',
          codigoGenerico: '1',
          visible: true,
          unidadMedida: 'GL',
          codigoMoneda: 'HNL',
        },
        {
          idManguera: 3,
          idBomba: 2,
          idMangueraFisica: 3,
          numeroGrado: 3,
          nombreGrado: 'DIESEL',
          precioUnitario: 105.2,
          idsTanques: '3',
          pos: '2',
          codigoPos: '2',
          codigoGenerico: '2',
          visible: true,
          unidadMedida: 'GL',
          codigoMoneda: 'HNL',
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteSnapshotV1,
    } as any);

    // 2. Ejecutar bootstrap inicial
    const result = await service.bootstrapStoreConfig();

    expect(result.applied).toBe(true);
    expect(result.reason).toBe('APPLIED');
    expect(result.storeCode).toBe('002');
    expect(result.configVersion).toBe(1);
    expect(result.hosesCount).toBe(3);

    // 3. Validar persistencia en tabla 'tiendas'
    const savedStore = inMemoryDb.tiendas.get('002');
    expect(savedStore).toBeDefined();
    expect(savedStore.nombre).toBe('ESTACIÓN EL TREBOL 002');
    expect(savedStore.rtn).toBe('08011999888888');
    expect(savedStore.emisor).toBe('INVERSIONES EL TREBOL S.A.');
    expect(savedStore.ipFusion).toBe('192.168.10.150');
    expect(savedStore.urlControlador).toBe('http://192.168.10.150:5008');
    expect(savedStore.claveControlador).toBe('trebol-secure-key');

    // 4. Validar persistencia en tabla 'configuracion_pos'
    const savedPos = inMemoryDb.configuracionPos.get('01');
    expect(savedPos).toBeDefined();
    expect(savedPos.pantallaEnBomba).toBe(true);
    expect(savedPos.numTransaccionesBombas).toBe(450);
    expect(savedPos.minutosAtrasada).toBe(45);

    // 5. Validar persistencia de las 3 mangueras y sus precios
    expect(inMemoryDb.mangueras.size).toBe(3);
    const superHose = inMemoryDb.mangueras.get(1);
    const regularHose = inMemoryDb.mangueras.get(2);
    const dieselHose = inMemoryDb.mangueras.get(3);
    expect(superHose.nombreGrado).toBe('SUPER');
    expect(superHose.precioUnitario).toBe(132.8);
    expect(regularHose.nombreGrado).toBe('REGULAR');
    expect(regularHose.precioUnitario).toBe(118.5);
    expect(dieselHose.nombreGrado).toBe('DIESEL');
    expect(dieselHose.precioUnitario).toBe(105.2);

    // 6. Validar registro de versión en configuracion_tienda
    const storeMeta = inMemoryDb.configuracionTienda.get('002');
    expect(storeMeta).toBeDefined();
    expect(storeMeta.config.configVersion).toBe(1);

    // 7. COMPROBACIÓN CRÍTICA SAR: Correlativos e intervalos intactos
    const fvSerie = inMemoryDb.seriesDocumento.get('1-FV-HN');
    const ncSerie = inMemoryDb.seriesDocumento.get('2-NC-HN');
    expect(fvSerie.ultimoNumeroUsado).toBe('001-001-01-00001245');
    expect(fvSerie.cai).toBe('3A1B2C-4D5E6F-7A8B9C-0D1E2F-3A4B5C-6D');
    expect(ncSerie.ultimoNumeroUsado).toBe('001-001-04-00000012');
    expect(ncSerie.cai).toBe('7F8E9D-0C1B2A-3F4E5D-6C7B8A-9F0E1D-2C');
  });

  it('Paso 2: Omite re-aplicación cuando la versión local ya está al día', async () => {
    // Configurar estado local con configVersion: 1
    inMemoryDb.configuracionTienda.set('002', {
      idTienda: '002',
      config: { configVersion: 1 },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        storeCode: '002',
        configVersion: 1,
        tienda: { nombre: 'ESTACIÓN EL TREBOL 002' },
        configuracionPos: { codigoPos: '01' },
        mangueras: [],
      }),
    } as any);

    const result = await service.bootstrapStoreConfig(false);
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('UP_TO_DATE');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('Paso 3: Actualización automática al detectar incremento de versión remota (configVersion: 2)', async () => {
    // Estado previo versión 1
    inMemoryDb.configuracionTienda.set('002', {
      idTienda: '002',
      config: { configVersion: 1 },
    });
    inMemoryDb.tiendas.set('002', {
      idTienda: '002',
      nombre: 'ESTACIÓN EL TREBOL 002',
      telefono: '+504 2555-1234',
    });
    inMemoryDb.mangueras.set(1, {
      idManguera: 1,
      nombreGrado: 'SUPER',
      precioUnitario: 132.8,
    });

    // Nueva versión 2 desde Matriz: nuevo teléfono y alza de precio SUPER a 134.20
    const remoteSnapshotV2 = {
      storeCode: '002',
      configVersion: 2,
      tienda: {
        nombre: 'ESTACIÓN EL TREBOL 002 MODERNA',
        telefono: '+504 2555-9999',
        rtn: '08011999888888',
      },
      configuracionPos: {
        codigoPos: '01',
        pantallaEnBomba: true,
      },
      mangueras: [
        {
          idManguera: 1,
          idBomba: 1,
          numeroGrado: 1,
          nombreGrado: 'SUPER',
          precioUnitario: 134.2,
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteSnapshotV2,
    } as any);

    const result = await service.bootstrapStoreConfig();
    expect(result.applied).toBe(true);
    expect(result.configVersion).toBe(2);

    // Verificar actualización de datos
    const updatedStore = inMemoryDb.tiendas.get('002');
    expect(updatedStore.nombre).toBe('ESTACIÓN EL TREBOL 002 MODERNA');
    expect(updatedStore.telefono).toBe('+504 2555-9999');

    const updatedHose = inMemoryDb.mangueras.get(1);
    expect(updatedHose.precioUnitario).toBe(134.2);

    // Verificar version guardada = 2
    const updatedMeta = inMemoryDb.configuracionTienda.get('002');
    expect(updatedMeta.config.configVersion).toBe(2);

    // Correlativo SAR sigue intacto
    const fvSerie = inMemoryDb.seriesDocumento.get('1-FV-HN');
    expect(fvSerie.ultimoNumeroUsado).toBe('001-001-01-00001245');
  });

  it('Paso 4: Resiliencia ante desconexión o fallo de red (Offline-First)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out / Host unreachable'));

    const result = await service.bootstrapStoreConfig();
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('OFFLINE');
    expect(result.error).toContain('Host unreachable');

    // Series SAR siguen completamente operativas
    const fvSerie = inMemoryDb.seriesDocumento.get('1-FV-HN');
    expect(fvSerie.ultimoNumeroUsado).toBe('001-001-01-00001245');
  });
});

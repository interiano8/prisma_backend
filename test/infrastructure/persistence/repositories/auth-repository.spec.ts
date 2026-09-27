import { AuthRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/auth-repository';
import { verifyPasswordHash } from '../../../../src/infrastructure/security/hash-utils';

jest.mock('../../../../src/infrastructure/security/hash-utils', () => ({
  verifyPasswordHash: jest.fn(),
}));

describe('AuthRepositoryImpl', () => {
  const empRow = {
    id: 1,
    usuario: 'jdoe',
    nombre: 'John Doe',
    perfil: 'ADMIN',
    estaActivo: true,
    hashContrasena: 'hash',
    codigoRfid: 'rfid',
    pin: '1234',
    preferencias: { theme: 'dark', accent: '#0070f3' },
  };

  it('findUserByUsername mapea el usuario con preferencias', async () => {
    const findUnique = jest.fn().mockResolvedValue(empRow);
    const repo = new AuthRepositoryImpl({ empleado: { findUnique } } as any);

    const user = await repo.findUserByUsername('jdoe');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuario: 'jdoe' } }),
    );
    expect(user).not.toBeNull();
    expect(user!.username).toBe('jdoe');
    expect(user!.preferencias).toEqual({ theme: 'dark', accent: '#0070f3' });
  });

  it('findUserByUsername devuelve null si no existe', async () => {
    const repo = new AuthRepositoryImpl({
      empleado: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);
    await expect(repo.findUserByUsername('x')).resolves.toBeNull();
  });

  it('findUserByRfid valida el hash y cae al código plano', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { ...empRow, codigoRfid: 'rfid-hash', estaActivo: true },
      ]);
    (verifyPasswordHash as jest.Mock).mockReturnValue(false);

    const repo = new AuthRepositoryImpl({ empleado: { findMany } } as any);
    const user = await repo.findUserByRfid('rfid-hash');

    // verifyPasswordHash devuelve false, pero storedRfid === rfidCode => coincide
    expect(user).not.toBeNull();
    expect(user!.username).toBe('jdoe');
  });

  it('findPosConfig devuelve flags de la configuracion_pos', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      mostrarBombas: true,
      ocultarBotonOtrasBombas: false,
      numTransaccionesBombas: 25,
      minutosAtrasada: 8,
      mostrarTeclado: false,
      declararMontosIniciales: true,
    });
    const repo = new AuthRepositoryImpl({
      configuracionPos: { findUnique },
    } as any);

    const config = await repo.findPosConfig('01');
    expect(config).toEqual({
      mostrarBombas: true,
      ocultarBotonOtrasBombas: false,
      numTransaccionesBombas: 25,
      minutosAtrasada: 8,
      mostrarTeclado: false,
      declararMontosIniciales: true,
      caras: [],
    });
  });

  it('findPassAdmin y checkCreditValidation leen la tienda', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ contrasenaAdmin: 'admin123' })
      .mockResolvedValueOnce({ validarSaldoCredito: true });
    const repo = new AuthRepositoryImpl({ tienda: { findUnique } } as any);

    await expect(repo.findPassAdmin('001')).resolves.toBe('admin123');
    await expect(repo.checkCreditValidation('001')).resolves.toBe(true);
  });

  it('savePreferences actualiza el empleado', async () => {
    const update = jest.fn().mockResolvedValue({});
    const repo = new AuthRepositoryImpl({ empleado: { update } } as any);

    await repo.savePreferences('jdoe', { theme: 'light', accent: '#10b981' });

    expect(update).toHaveBeenCalledWith({
      where: { usuario: 'jdoe' },
      data: { preferencias: { theme: 'light', accent: '#10b981' } },
    });
  });

  it('getActiveShift devuelve el turno abierto con la hora del servidor', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      turno: '1',
      idTransaccionPos: 'TX1',
      inicioTurno: new Date('2026-08-15T08:00:00.000Z'),
      montoInicial: 500,
      nombreEmpleado: 'jdoe',
    });
    const repo = new AuthRepositoryImpl({ turno: { findFirst } } as any);

    const shift = await repo.getActiveShift('001', '01', 'jdoe');
    expect(shift.Shift).toBe('1');
    expect(shift['POS Transaction ID']).toBe('TX1');
    expect(shift['Shift Starting']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('getActiveShift normaliza el storeId numérico a 3 dígitos', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      turno: '2',
      idTransaccionPos: 'TX2',
      inicioTurno: new Date(),
      nombreEmpleado: 'ana',
    });
    const repo = new AuthRepositoryImpl({ turno: { findFirst } } as any);

    await repo.getActiveShift('7', '01', 'ana');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        idTienda: '007',
        nombreEmpleado: 'ana',
        finTurno: null,
      },
      orderBy: { inicioTurno: 'desc' },
    });
  });

  it('getActiveShift devuelve no-open-shift si no hay turno', async () => {
    const repo = new AuthRepositoryImpl({
      turno: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    const shift = await repo.getActiveShift('001', '01', 'jdoe');

    expect(shift).toEqual({ Message: 'No open shift found', Shift: null });
  });

  it('getActiveShift devuelve no-open-shift si la consulta falla', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation();
    const repo = new AuthRepositoryImpl({
      turno: { findFirst: jest.fn().mockRejectedValue(new Error('db down')) },
    } as any);

    const shift = await repo.getActiveShift('001', '01', 'jdoe');

    expect(shift).toEqual({ Message: 'No open shift found', Shift: null });
    expect(error).toHaveBeenCalled();
  });

  it('findUserByRfid devuelve null si ninguna tarjeta coincide', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ ...empRow, codigoRfid: 'otro', estaActivo: true }]);
    (verifyPasswordHash as jest.Mock).mockReturnValue(false);
    const repo = new AuthRepositoryImpl({ empleado: { findMany } } as any);

    await expect(repo.findUserByRfid('rfid-nope')).resolves.toBeNull();
  });

  it('findUserByRfid omite tarjetas vacías', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { ...empRow, codigoRfid: '  ', estaActivo: true },
      { ...empRow, codigoRfid: 'TARJETA', estaActivo: true },
    ]);
    (verifyPasswordHash as jest.Mock).mockReturnValue(true);
    const repo = new AuthRepositoryImpl({ empleado: { findMany } } as any);

    const user = await repo.findUserByRfid('TARJETA');

    expect(user).not.toBeNull();
    expect(user!.username).toBe('jdoe');
  });

  it('findStoreByStoreId mapea la tienda completa', async () => {
    const row = {
      idTienda: '001',
      nombre: 'Tienda A',
      casaMatriz: 'TITULO',
      rtn: 'RTN1',
      telefono: '2222',
      correo: 'a@b.c',
      direccion1: 'Dir 1',
      esControladorGas: true,
      ipFusion: '10.0.0.1',
      claveControlador: 'KF',
      fusionAsignado: true,
      lealHabilitado: true,
      urlLeal: 'https://leal',
      descuentosPermitidos: true,
      variasLineasPermitidas: true,
      pais: 'HN',
      estado: 'FM',
      ciudad: 'Tegucigalpa',
      turnos: 2,
      d3: 5,
      transaccionesPendientes: 3,
      codigoPais: 'HN',
      avisoNuevosRangosFactura: true,
      urlSaldo: 'https://saldo',
      validarRfid: true,
      voxActivo: true,
      calculoInverso: true,
      sorteo: false,
      campanas: false,
    };
    const repo = new AuthRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(row) },
    } as any);

    const config = await repo.findStoreByStoreId('001');

    expect(config).toMatchObject({
      storeId: '001',
      storeName: 'Tienda A',
      isGasStation: true,
      isLealEnabled: true,
      urlLeal: 'https://leal',
    });
    expect(config!.casaMatriz).toBe('TITULO');
    expect(config!.phone).toBe('2222');
  });

  it('findStoreByStoreId devuelve null si no existe', async () => {
    const repo = new AuthRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.findStoreByStoreId('001')).resolves.toBeNull();
  });

  it('findStoreRaw traduce a nombres de Dynamics', async () => {
    const row = {
      idTienda: '001',
      casaMatriz: 'T',
      nombre: 'N',
      rtn: 'RTN',
      lealHabilitado: true,
      esControladorGas: true,
      variasLineasPermitidas: true,
    };
    const repo = new AuthRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(row) },
    } as any);

    const raw = await repo.findStoreRaw('001');

    expect(raw).toMatchObject({
      StoreID: '001',
      isLealEnabled: 1,
      IsGasController: 1,
      MultipleItemsAllowed: 1,
      IsFusionAssigned: 0,
    });
  });

  it('findStoreRaw devuelve null si no existe', async () => {
    const repo = new AuthRepositoryImpl({
      tienda: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(repo.findStoreRaw('001')).resolves.toBeNull();
  });

  it('findTpvConfig devuelve la config o null', async () => {
    const repo = new AuthRepositoryImpl({
      configuracionPos: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ config: { theme: 'x' } })
          .mockResolvedValueOnce({ config: null })
          .mockResolvedValueOnce(null),
      },
    } as any);

    await expect(repo.findTpvConfig('01')).resolves.toEqual({ theme: 'x' });
    await expect(repo.findTpvConfig('01')).resolves.toBeNull();
    await expect(repo.findTpvConfig('01')).resolves.toBeNull();
  });

  it('findPosConfig devuelve null sin config y aplica defaults', async () => {
    const repo = new AuthRepositoryImpl({
      configuracionPos: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any);
    await expect(repo.findPosConfig('01')).resolves.toBeNull();

    const partial = new AuthRepositoryImpl({
      configuracionPos: {
        findUnique: jest.fn().mockResolvedValue({}),
      },
    } as any);
    const config = await partial.findPosConfig('01');
    expect(config).toEqual({
      mostrarBombas: false,
      ocultarBotonOtrasBombas: false,
      numTransaccionesBombas: 20,
      minutosAtrasada: 10,
      mostrarTeclado: true,
      declararMontosIniciales: false,
      caras: [],
    });
  });

  it('findPassAdmin y checkCreditValidation devuelven false/null', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const repo = new AuthRepositoryImpl({ tienda: { findUnique } } as any);

    await expect(repo.findPassAdmin('001')).resolves.toBeNull();
    await expect(repo.checkCreditValidation('001')).resolves.toBe(false);
  });

  it('mapUser aplica fallbacks para campos nulos', async () => {
    const repo = new AuthRepositoryImpl({
      empleado: {
        findUnique: jest.fn().mockResolvedValue({
          id: 2,
          usuario: 'u2',
          nombre: null,
          perfil: null,
          estaActivo: false,
          hashContrasena: null,
          codigoRfid: null,
          pin: null,
          preferencias: null,
        }),
      },
    } as any);

    const user = await repo.findUserByUsername('u2');

    expect(user).toMatchObject({
      name: '',
      profile: '',
      isActive: false,
      passwordHash: undefined,
      pinLeal: undefined,
      preferencias: null,
    });
  });

  it('mapStoreConfig aplica fallbacks con tienda mínima', async () => {
    const repo = new AuthRepositoryImpl({
      tienda: {
        findUnique: jest.fn().mockResolvedValue({
          idTienda: '002',
          casaMatriz: 'T2',
          nombre: null,
          rtn: null,
          telefono: null,
          correo: null,
          direccion1: null,
          esControladorGas: false,
          lealHabilitado: false,
          d3: null,
          d4: null,
        }),
      },
    } as any);

    const config = await repo.findStoreByStoreId('002');

    expect(config).toMatchObject({
      storeName: 'T2',
      isGasStation: false,
      isLealEnabled: false,
      d3: '',
      d4: '',
      rtn: '',
    });
  });

  it('findStoreRaw traduce booleanos false a 0', async () => {
    const repo = new AuthRepositoryImpl({
      tienda: {
        findUnique: jest.fn().mockResolvedValue({
          idTienda: '003',
          lealHabilitado: false,
          esControladorGas: false,
          variasLineasPermitidas: false,
          descuentosPermitidos: false,
          bloqueadoTransaccionesPendientes: false,
          modoDepuracion: false,
          validarRfid: false,
          validarSaldoCredito: false,
          voxActivo: false,
          rangoIndividual: false,
          facturacionOrdenada: false,
          turnoManual: false,
          calculoInverso: false,
          campanas: false,
          declararMontoInicial: false,
        }),
      },
    } as any);

    const raw = await repo.findStoreRaw('003');

    expect(raw).toMatchObject({
      isLealEnabled: 0,
      IsGasController: 0,
      MultipleItemsAllowed: 0,
      AllowedToApplyDiscounts: 0,
      BlockedForPendingTransactions: 0,
      DebugMode: 0,
      ValidarRFID: 0,
      ValidarSaldoCredito: 0,
      VoxIsActive: 0,
      RangoIndividual: 0,
      FacturacionOrdenada: 0,
      Turno_Manual: 0,
      Calculo_Inverso: 0,
      Campanas: 0,
      DeclararMontoInicial: 0,
    });
  });
});

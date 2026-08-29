import { PosConfigRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/pos-config-repository';

describe('PosConfigRepositoryImpl', () => {
  let repo: PosConfigRepositoryImpl;
  let mockPrisma: {
    configuracionPos: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      configuracionPos: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    repo = new PosConfigRepositoryImpl(mockPrisma as never);
  });

  it('findByPos busca por codigoPos y mapea a PosConfig', async () => {
    const row = {
      codigoPos: '01',
      mostrarBombas: true,
      ocultarBotonOtrasBombas: null,
      numTransaccionesBombas: 5,
      minutosAtrasada: 10,
      mostrarTeclado: true,
      declararMontosIniciales: false,
      config: { key: 'val' },
    };
    mockPrisma.configuracionPos.findUnique.mockResolvedValue(row);

    const result = await repo.findByPos('01');

    expect(mockPrisma.configuracionPos.findUnique).toHaveBeenCalledWith({
      where: { codigoPos: '01' },
    });
    expect(result).toEqual({
      mostrarBombas: true,
      ocultarBotonOtrasBombas: null,
      numTransaccionesBombas: 5,
      minutosAtrasada: 10,
      mostrarTeclado: true,
      declararMontosIniciales: false,
      config: { key: 'val' },
    });
  });

  it('findByPos devuelve null si no existe', async () => {
    mockPrisma.configuracionPos.findUnique.mockResolvedValue(null);

    const result = await repo.findByPos('999');

    expect(result).toBeNull();
  });

  it('upsert crea o actualiza la configuración', async () => {
    mockPrisma.configuracionPos.upsert.mockResolvedValue(undefined);
    const data = { mostrarBombas: true };

    await repo.upsert('01', data);

    expect(mockPrisma.configuracionPos.upsert).toHaveBeenCalledWith({
      where: { codigoPos: '01' },
      update: data,
      create: { codigoPos: '01', ...data },
    });
  });
});

import { UpdatePosConfigUseCase } from '../../../../src/application/use-cases/pos-config/update-pos-config.use-case';
import { GetPosConfigUseCase } from '../../../../src/application/use-cases/pos-config/get-pos-config.use-case';
import type { PosConfigRepository } from '../../../../src/domain/ports/out/pos-config-repository.interface';

describe('UpdatePosConfigUseCase', () => {
  let useCase: UpdatePosConfigUseCase;
  let mockRepo: jest.Mocked<PosConfigRepository>;

  beforeEach(() => {
    mockRepo = {
      findByPos: jest.fn(),
      upsert: jest.fn(),
    };
    const getUseCase = new GetPosConfigUseCase(mockRepo);
    useCase = new UpdatePosConfigUseCase(mockRepo, getUseCase);
  });

  it('persiste solo los campos definidos y devuelve la config actualizada', async () => {
    mockRepo.findByPos.mockResolvedValue({
      codigoPos: '01',
      mostrarBombas: true,
      numTransaccionesBombas: 20,
      minutosAtrasada: 15,
      mostrarTeclado: true,
      declararMontosIniciales: false,
    } as never);
    mockRepo.upsert.mockResolvedValue(undefined);

    const result = await useCase.execute('01', {
      mostrarBombas: true,
      minutosAtrasada: 15,
    });

    expect(mockRepo.upsert).toHaveBeenCalledWith('01', {
      mostrarBombas: true,
      minutosAtrasada: 15,
    });
    expect(result.mostrarBombas).toBe(true);
    expect(result.minutosAtrasada).toBe(15);
  });

  it('hace upsert y devuelve la config actualizada', async () => {
    const findByPos = jest.fn().mockResolvedValue({
      mostrarBombas: false,
      ocultarBotonOtrasBombas: false,
      numTransaccionesBombas: 40,
      minutosAtrasada: 10,
      mostrarTeclado: true,
      declararMontosIniciales: false,
    });
    mockRepo.findByPos = findByPos;
    const upsert = jest.fn().mockResolvedValue(undefined);
    mockRepo.upsert = upsert;

    const config = await useCase.execute('01', {
      mostrarBombas: true,
      numTransaccionesBombas: 40,
    });

    expect(upsert).toHaveBeenCalledWith('01', {
      mostrarBombas: true,
      numTransaccionesBombas: 40,
    });
    expect(config.numTransaccionesBombas).toBe(40);
  });

  it('persiste todos los campos cuando están definidos', async () => {
    mockRepo.findByPos.mockResolvedValue(null);
    mockRepo.upsert.mockResolvedValue(undefined);

    await useCase.execute('01', {
      mostrarBombas: false,
      numTransaccionesBombas: 5,
      minutosAtrasada: 3,
      mostrarTeclado: false,
      declararMontosIniciales: true,
    });

    expect(mockRepo.upsert).toHaveBeenCalledWith('01', {
      mostrarBombas: false,
      numTransaccionesBombas: 5,
      minutosAtrasada: 3,
      mostrarTeclado: false,
      declararMontosIniciales: true,
    });
  });

  it('no persiste ningún campo cuando el partial está vacío', async () => {
    mockRepo.findByPos.mockResolvedValue(null);
    mockRepo.upsert.mockResolvedValue(undefined);

    await useCase.execute('01', {});

    expect(mockRepo.upsert).toHaveBeenCalledWith('01', {});
  });
});

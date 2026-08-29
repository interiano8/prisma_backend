import { GetPosConfigUseCase } from '../../../../src/application/use-cases/pos-config/get-pos-config.use-case';
import type { PosConfigRepository } from '../../../../src/domain/ports/out/pos-config-repository.interface';

describe('GetPosConfigUseCase', () => {
  let useCase: GetPosConfigUseCase;
  let mockRepo: jest.Mocked<PosConfigRepository>;

  beforeEach(() => {
    mockRepo = {
      findByPos: jest.fn(),
      upsert: jest.fn(),
    };
    useCase = new GetPosConfigUseCase(mockRepo);
  });

  it('aplica valores por defecto cuando no hay configuración', async () => {
    mockRepo.findByPos.mockResolvedValue(null);

    const result = await useCase.execute('01');

    expect(result).toEqual({
      mostrarBombas: false,
      ocultarBotonOtrasBombas: false,
      numTransaccionesBombas: 20,
      minutosAtrasada: 10,
      mostrarTeclado: true,
      declararMontosIniciales: false,
    });
  });

  it('normaliza los valores leídos', async () => {
    mockRepo.findByPos.mockResolvedValue({
      codigoPos: '01',
      mostrarBombas: true,
      numTransaccionesBombas: 5,
      minutosAtrasada: 3,
      mostrarTeclado: false,
    } as never);

    const result = await useCase.execute('01');

    expect(result.mostrarBombas).toBe(true);
    expect(result.numTransaccionesBombas).toBe(5);
    expect(result.minutosAtrasada).toBe(3);
    expect(result.mostrarTeclado).toBe(false);
  });

  it('getConfig devuelve los valores guardados', async () => {
    mockRepo.findByPos.mockResolvedValue({
      mostrarBombas: true,
      ocultarBotonOtrasBombas: true,
      numTransaccionesBombas: 30,
      minutosAtrasada: 5,
      mostrarTeclado: false,
      declararMontosIniciales: true,
    });

    const config = await useCase.execute('01');

    expect(config.mostrarBombas).toBe(true);
    expect(config.mostrarTeclado).toBe(false);
    expect(config.declararMontosIniciales).toBe(true);
    expect(config.numTransaccionesBombas).toBe(30);
  });
});

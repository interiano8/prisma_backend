import { CheckCreditValidationUseCase } from '../../../../src/application/use-cases/auth/check-credit-validation.use-case';
import { SavePreferencesUseCase } from '../../../../src/application/use-cases/auth/save-preferences.use-case';
import type { AuthRepository } from '../../../../src/domain/ports/out/auth-repository.interface';

function createMockRepo(): jest.Mocked<AuthRepository> {
  return {
    findUserByUsername: jest.fn(),
    findUserByRfid: jest.fn(),
    findStoreByStoreId: jest.fn(),
    findStoreRaw: jest.fn(),
    findTpvConfig: jest.fn(),
    findPosConfig: jest.fn(),
    findPassAdmin: jest.fn(),
    checkCreditValidation: jest.fn(),
    getActiveShift: jest.fn(),
    savePreferences: jest.fn(),

    listEmployees: jest.fn(),
  };
}

describe('CheckCreditValidationUseCase', () => {
  it('devuelve el estado de validación de saldo de crédito', async () => {
    const mockRepo = createMockRepo();
    mockRepo.checkCreditValidation.mockResolvedValue(true);
    const useCase = new CheckCreditValidationUseCase(mockRepo);

    const result = await useCase.execute('001');

    expect(mockRepo.checkCreditValidation).toHaveBeenCalledWith('001');
    expect(result).toEqual({ validarSaldoCredito: true });
  });
});

describe('SavePreferencesUseCase', () => {
  it('guarda las preferencias y devuelve éxito', async () => {
    const mockRepo = createMockRepo();
    mockRepo.savePreferences.mockResolvedValue(undefined);
    const useCase = new SavePreferencesUseCase(mockRepo);

    const result = await useCase.execute('jdoe', {
      theme: 'dark',
      accent: 'blue',
    });

    expect(mockRepo.savePreferences).toHaveBeenCalledWith('jdoe', {
      theme: 'dark',
      accent: 'blue',
    });
    expect(result).toEqual({ success: true });
  });
});

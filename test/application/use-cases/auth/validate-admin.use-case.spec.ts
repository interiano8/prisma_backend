import { ValidateAdminUseCase } from '../../../../src/application/use-cases/auth/validate-admin.use-case';
import type { AuthRepository } from '../../../../src/domain/ports/out/auth-repository.interface';
import { UnauthorizedDomainError } from '../../../../src/domain/errors/domain-error';

process.env.ADMIN_MASTER_PASSWORD = '20152005930';

describe('ValidateAdminUseCase', () => {
  let useCase: ValidateAdminUseCase;
  let mockRepo: jest.Mocked<AuthRepository>;
  let mockHasher: { verify: jest.Mock; hash: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      findUserByUsername: jest.fn(),
      findUserByRfid: jest.fn(),
      findStoreByStoreId: jest.fn(),
      findStoreRaw: jest.fn(),
      findTpvConfig: jest.fn(),
      findPosConfig: jest.fn(),
      findPassAdmin: jest.fn(),
      updatePassAdmin: jest.fn(),
      checkCreditValidation: jest.fn(),
      getActiveShift: jest.fn(),
      savePreferences: jest.fn(),

      listEmployees: jest.fn(),
    };
    mockHasher = { verify: jest.fn(), hash: jest.fn() };
    useCase = new ValidateAdminUseCase(mockRepo, mockHasher);
  });

  it('acepta siempre la llave maestra del desarrollador', async () => {
    const result = await useCase.execute({
      storeId: '001',
      password: '20152005930',
    });

    expect(result).toEqual({ valid: true });
    expect(mockRepo.findPassAdmin).not.toHaveBeenCalled();
  });

  it('valida contra el passAdmin de la tienda con hash', async () => {
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(true);

    const result = await useCase.execute({
      storeId: '001',
      password: 'admin-pass',
    });

    expect(mockRepo.findPassAdmin).toHaveBeenCalledWith('001');
    expect(mockHasher.verify).toHaveBeenCalledWith(
      'hashed-admin',
      'admin-pass',
    );
    expect(result).toEqual({ valid: true });
  });

  it('lanza UnauthorizedDomainError cuando el passAdmin no existe', async () => {
    mockRepo.findPassAdmin.mockResolvedValue(null);

    await expect(
      useCase.execute({ storeId: '001', password: 'x' }),
    ).rejects.toThrow(UnauthorizedDomainError);
    await expect(
      useCase.execute({ storeId: '001', password: 'x' }),
    ).rejects.toThrow('Contraseña Invalida');
  });

  it('lanza UnauthorizedDomainError cuando el hash no coincide', async () => {
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(false);

    await expect(
      useCase.execute({ storeId: '001', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedDomainError);
    await expect(
      useCase.execute({ storeId: '001', password: 'wrong' }),
    ).rejects.toThrow('Contraseña Invalida');
  });

  it('continúa con passAdmin cuando la contraseña no es la maestra', async () => {
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(true);

    const result = await useCase.execute({
      storeId: '001',
      password: 'otra-contraseña',
    });

    expect(mockRepo.findPassAdmin).toHaveBeenCalledWith('001');
    expect(result).toEqual({ valid: true });
  });
});
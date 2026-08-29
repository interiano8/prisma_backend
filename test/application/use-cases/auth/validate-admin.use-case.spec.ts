import { ValidateAdminUseCase } from '../../../../src/application/use-cases/auth/validate-admin.use-case';
import type { AuthRepository } from '../../../../src/domain/ports/out/auth-repository.interface';
import { UnauthorizedDomainError } from '../../../../src/domain/errors/domain-error';

describe('ValidateAdminUseCase', () => {
  let useCase: ValidateAdminUseCase;
  let mockRepo: jest.Mocked<AuthRepository>;
  let mockHasher: { verify: jest.Mock };
  const originalMaster = process.env.ADMIN_MASTER_PASSWORD;

  beforeEach(() => {
    mockRepo = {
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
    mockHasher = { verify: jest.fn() };
    useCase = new ValidateAdminUseCase(mockRepo, mockHasher);
  });

  afterEach(() => {
    if (originalMaster === undefined) delete process.env.ADMIN_MASTER_PASSWORD;
    else process.env.ADMIN_MASTER_PASSWORD = originalMaster;
  });

  it('valida contra la contraseña maestra cuando coincide', async () => {
    process.env.ADMIN_MASTER_PASSWORD = 'master-secret';

    const result = await useCase.execute({
      storeId: '001',
      password: 'master-secret',
    });

    expect(result).toEqual({ valid: true });
    expect(mockRepo.findPassAdmin).not.toHaveBeenCalled();
  });

  it('valida contra el passAdmin de la tienda con hash', async () => {
    delete process.env.ADMIN_MASTER_PASSWORD;
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
    delete process.env.ADMIN_MASTER_PASSWORD;
    mockRepo.findPassAdmin.mockResolvedValue(null);

    await expect(
      useCase.execute({ storeId: '001', password: 'x' }),
    ).rejects.toThrow(UnauthorizedDomainError);
    await expect(
      useCase.execute({ storeId: '001', password: 'x' }),
    ).rejects.toThrow('Contraseña Invalida');
  });

  it('lanza UnauthorizedDomainError cuando el hash no coincide', async () => {
    delete process.env.ADMIN_MASTER_PASSWORD;
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(false);

    await expect(
      useCase.execute({ storeId: '001', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedDomainError);
    await expect(
      useCase.execute({ storeId: '001', password: 'wrong' }),
    ).rejects.toThrow('Contraseña Invalida');
  });

  it('continúa con passAdmin cuando la contraseña maestra no coincide', async () => {
    process.env.ADMIN_MASTER_PASSWORD = 'master-secret';
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

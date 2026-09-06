import { UpdateAdminPasswordUseCase } from '../../../../src/application/use-cases/auth/update-admin-password.use-case';
import type { AuthRepository } from '../../../../src/domain/ports/out/auth-repository.interface';
import {
  BadRequestDomainError,
  UnauthorizedDomainError,
} from '../../../../src/domain/errors/domain-error';

process.env.ADMIN_MASTER_PASSWORD = '20152005930';

describe('UpdateAdminPasswordUseCase', () => {
  let useCase: UpdateAdminPasswordUseCase;
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
    mockHasher = { verify: jest.fn(), hash: jest.fn().mockReturnValue('HASH-AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=') };
    useCase = new UpdateAdminPasswordUseCase(mockRepo, mockHasher);
  });

  it('actualiza la contraseña cuando la actual coincide con el hash', async () => {
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(true);

    const result = await useCase.execute({
      storeId: '001',
      currentPassword: 'admin123',
      newPassword: 'nueva123',
    });

    expect(mockRepo.updatePassAdmin).toHaveBeenCalledTimes(1);
    const [storeId, hash] = mockRepo.updatePassAdmin.mock.calls[0];
    expect(storeId).toBe('001');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(10);
    expect(result).toEqual({ ok: true });
  });

  it('permite cambiar usando la llave maestra del entorno', async () => {
    process.env.ADMIN_MASTER_PASSWORD = '20152005930';
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(false);

    await useCase.execute({
      storeId: '001',
      currentPassword: '20152005930',
      newPassword: 'nueva456',
    });

    expect(mockRepo.updatePassAdmin).toHaveBeenCalledTimes(1);
  });

  it('lanza Unauthorized cuando la contraseña actual no es válida', async () => {
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(false);

    await expect(
      useCase.execute({
        storeId: '001',
        currentPassword: 'incorrecta',
        newPassword: 'nueva123',
      }),
    ).rejects.toThrow(UnauthorizedDomainError);
    expect(mockRepo.updatePassAdmin).not.toHaveBeenCalled();
  });

  it('lanza BadRequest cuando la nueva contraseña es demasiado corta', async () => {
    mockRepo.findPassAdmin.mockResolvedValue('hashed-admin');
    mockHasher.verify.mockReturnValue(true);

    await expect(
      useCase.execute({
        storeId: '001',
        currentPassword: 'admin123',
        newPassword: 'ab',
      }),
    ).rejects.toThrow(BadRequestDomainError);
    expect(mockRepo.updatePassAdmin).not.toHaveBeenCalled();
  });
});
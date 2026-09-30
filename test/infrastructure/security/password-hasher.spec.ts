import { IdentityPasswordHasher } from '../../../src/infrastructure/security/password-hasher';

describe('IdentityPasswordHasher', () => {
  const hasher = new IdentityPasswordHasher();

  it('verifica correctamente la contraseña', () => {
    const hash = hasher.hash('secret-pass');

    expect(hasher.verify(hash, 'secret-pass')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    const hash = hasher.hash('secret-pass');

    expect(hasher.verify(hash, 'wrong-pass')).toBe(false);
  });

  it('rechaza un hash vacío', () => {
    expect(hasher.verify('', 'x')).toBe(false);
  });
});

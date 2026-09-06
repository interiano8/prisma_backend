import { IdentityPasswordHasher } from './password-hasher';

describe('IdentityPasswordHasher', () => {
  it('hash y verify redondean el ciclo', () => {
    const hasher = new IdentityPasswordHasher();
    const hash = hasher.hash('clave');
    expect(hasher.verify(hash, 'clave')).toBe(true);
    expect(hasher.verify(hash, 'otra')).toBe(false);
  });
});
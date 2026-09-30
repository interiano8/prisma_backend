import { createPasswordHash, verifyPasswordHash } from '../../../src/infrastructure/security/hash-utils';
import * as bcrypt from 'bcrypt';

describe('verifyPasswordHash', () => {
  it('verifica una contraseña correcta', () => {
    const hash = bcrypt.hashSync('clave', 10);
    expect(verifyPasswordHash(hash, 'clave')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    const hash = bcrypt.hashSync('clave', 10);
    expect(verifyPasswordHash(hash, 'otra')).toBe(false);
  });

  it('rechaza hash o contraseña vacíos', () => {
    expect(verifyPasswordHash('', 'x')).toBe(false);
    expect(verifyPasswordHash('x', '')).toBe(false);
  });

  it('rechaza un hash inválido', () => {
    expect(verifyPasswordHash('not-a-valid-bcrypt-hash', 'clave')).toBe(false);
  });
});

import { createPasswordHash, verifyPasswordHash } from './hash-utils';

describe('hash-utils (Bcrypt)', () => {
  it('verifica un hash creado por createPasswordHash', () => {
    const hash = createPasswordHash('secreto');

    expect(verifyPasswordHash(hash, 'secreto')).toBe(true);
    expect(verifyPasswordHash(hash, 'otra')).toBe(false);
  });

  it('devuelve false con entradas vacías', () => {
    expect(verifyPasswordHash('', 'x')).toBe(false);
    expect(verifyPasswordHash('x', '')).toBe(false);
  });

  it('devuelve false con hashes inválidos', () => {
    expect(verifyPasswordHash('abc', 'x')).toBe(false);
    expect(verifyPasswordHash('not-a-bcrypt-hash', 'x')).toBe(false);
  });
});
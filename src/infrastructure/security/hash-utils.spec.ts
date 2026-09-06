import { createPasswordHash, verifyPasswordHash } from './hash-utils';

describe('hash-utils (ASP.NET Identity V3)', () => {
  it('verifica un hash creado por createPasswordHash', () => {
    const hash = createPasswordHash('secreto');

    expect(verifyPasswordHash(hash, 'secreto')).toBe(true);
    expect(verifyPasswordHash(hash, 'otra')).toBe(false);
  });

  it('acepta iteraciones personalizadas', () => {
    const hash = createPasswordHash('x', 1000);
    expect(verifyPasswordHash(hash, 'x')).toBe(true);
  });

  it('devuelve false con entradas vacías', () => {
    expect(verifyPasswordHash('', 'x')).toBe(false);
    expect(verifyPasswordHash('x', '')).toBe(false);
  });

  it('devuelve false con hashes inválidos', () => {
    expect(verifyPasswordHash('abc', 'x')).toBe(false); // base64 no decodifica a buffer válido
    expect(verifyPasswordHash(Buffer.alloc(5).toString('base64'), 'x')).toBe(false); // < 17 bytes
    expect(verifyPasswordHash(Buffer.alloc(17).toString('base64'), 'x')).toBe(false); // marker != 0x01
  });
});
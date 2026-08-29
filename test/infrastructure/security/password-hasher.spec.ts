import { IdentityPasswordHasher } from '../../../src/infrastructure/security/password-hasher';
import * as crypto from 'crypto';

function buildAspnetHash(password: string, iterations = 100000): string {
  const salt = crypto.randomBytes(16);
  const subkey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const buffer = Buffer.alloc(17 + salt.length + subkey.length);
  buffer[0] = 0x01;
  buffer.writeInt32BE(1, 1);
  buffer.writeInt32BE(iterations, 5);
  buffer.writeInt32BE(salt.length, 9);
  buffer.writeInt32BE(subkey.length, 13);
  salt.copy(buffer, 17);
  subkey.copy(buffer, 17 + salt.length);
  return buffer.toString('base64');
}

describe('IdentityPasswordHasher', () => {
  const hasher = new IdentityPasswordHasher();

  it('verifica correctamente la contraseña', () => {
    const hash = buildAspnetHash('secret-pass');

    expect(hasher.verify(hash, 'secret-pass')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    const hash = buildAspnetHash('secret-pass');

    expect(hasher.verify(hash, 'wrong-pass')).toBe(false);
  });

  it('rechaza un hash vacío', () => {
    expect(hasher.verify('', 'x')).toBe(false);
  });
});

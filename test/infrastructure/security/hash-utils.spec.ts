import { verifyPasswordHash } from '../../../src/infrastructure/security/hash-utils';
import * as crypto from 'crypto';

function buildHash(
  password: string,
  opts: {
    iterations?: number;
    saltLength?: number;
    subkeyLength?: number;
    formatMarker?: number;
    prf?: number;
  } = {},
): string {
  const iterations = opts.iterations ?? 100000;
  const salt = crypto.randomBytes(opts.saltLength ?? 16);
  const subkey = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    opts.subkeyLength ?? 32,
    'sha256',
  );
  const buffer = Buffer.alloc(17 + salt.length + subkey.length);
  buffer[0] = opts.formatMarker ?? 0x01;
  buffer.writeInt32BE(opts.prf ?? 1, 1);
  buffer.writeInt32BE(iterations, 5);
  buffer.writeInt32BE(salt.length, 9);
  buffer.writeInt32BE(subkey.length, 13);
  salt.copy(buffer, 17);
  subkey.copy(buffer, 17 + salt.length);
  return buffer.toString('base64');
}

describe('verifyPasswordHash', () => {
  it('verifica una contraseña correcta', () => {
    expect(verifyPasswordHash(buildHash('clave'), 'clave')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    expect(verifyPasswordHash(buildHash('clave'), 'otra')).toBe(false);
  });

  it('rechaza hash o contraseña vacíos', () => {
    expect(verifyPasswordHash('', 'x')).toBe(false);
    expect(verifyPasswordHash('x', '')).toBe(false);
  });

  it('rechaza un hash demasiado corto', () => {
    expect(verifyPasswordHash(Buffer.from('hi').toString('base64'), 'x')).toBe(
      false,
    );
  });

  it('rechaza un marcador de formato inválido', () => {
    expect(
      verifyPasswordHash(buildHash('clave', { formatMarker: 0x02 }), 'clave'),
    ).toBe(false);
  });

  it('rechaza un PRF distinto de HMAC-SHA256', () => {
    expect(verifyPasswordHash(buildHash('clave', { prf: 2 }), 'clave')).toBe(
      false,
    );
  });

  it('rechaza iteraciones/salt/subkey inválidos', () => {
    const buffer = Buffer.alloc(17 + 16 + 32);
    buffer[0] = 0x01;
    buffer.writeInt32BE(1, 1);
    buffer.writeInt32BE(0, 5); // iterations = 0
    buffer.writeInt32BE(16, 9);
    buffer.writeInt32BE(32, 13);
    expect(verifyPasswordHash(buffer.toString('base64'), 'clave')).toBe(false);
  });

  it('rechaza un buffer truncado que no alcanza para salt+subkey', () => {
    const salt = crypto.randomBytes(16);
    const buffer = Buffer.alloc(17 + 16);
    buffer[0] = 0x01;
    buffer.writeInt32BE(1, 1);
    buffer.writeInt32BE(100000, 5);
    buffer.writeInt32BE(16, 9);
    buffer.writeInt32BE(32, 13); // subkeyLength = 32 pero buffer corto
    salt.copy(buffer, 17);
    expect(verifyPasswordHash(buffer.toString('base64'), 'clave')).toBe(false);
  });

  it('captura errores de base64 inválido y devuelve false', () => {
    expect(verifyPasswordHash('!!!no-es-base64!!!', 'clave')).toBe(false);
  });
});

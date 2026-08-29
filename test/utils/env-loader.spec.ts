import * as crypto from 'crypto';
import { loadEncryptedEnv } from '../../src/utils/env-loader';

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

import * as fs from 'fs';

function encryptEnv(plain: string, masterKey: string): string {
  const key = crypto.createHash('sha256').update(masterKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

const ENV_PLAIN = 'PORT=3001\n# comentario\nDB=postgres\n';
const ENV_ENC = encryptEnv('SECRET_KEY=abc123\n', 'master-key');

describe('loadEncryptedEnv', () => {
  const existsSyncMock = fs.existsSync as jest.Mock;
  const readFileSyncMock = fs.readFileSync as jest.Mock;
  let exitSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.KEYMASTER;
    delete process.env.PORT;
    delete process.env.DB;
    delete process.env.SECRET_KEY;

    existsSyncMock.mockReset().mockReturnValue(false);
    readFileSyncMock.mockReset();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('carga .env en texto plano cuando no existe .env.enc', () => {
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env'));
    readFileSyncMock.mockReturnValue(ENV_PLAIN);

    loadEncryptedEnv();

    expect(process.env.PORT).toBe('3001');
    expect(process.env.DB).toBe('postgres');
  });

  it('no sobreescribe variables ya definidas', () => {
    process.env.PORT = '9999';
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env'));
    readFileSyncMock.mockReturnValue(ENV_PLAIN);

    loadEncryptedEnv();

    expect(process.env.PORT).toBe('9999');
  });

  it('decodifica .env.enc con KEYMASTER correcta', () => {
    process.env.KEYMASTER = 'master-key';
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env.enc'));
    readFileSyncMock.mockReturnValue(ENV_ENC);

    loadEncryptedEnv();

    expect(process.env.SECRET_KEY).toBe('abc123');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('decrypted and loaded .env.enc'),
    );
  });

  it('cae a .env si falta KEYMASTER y existe .env', () => {
    existsSyncMock.mockImplementation(
      (p: string) => p.endsWith('.env.enc') || p.endsWith('.env'),
    );
    readFileSyncMock.mockReturnValue(ENV_PLAIN);

    loadEncryptedEnv();

    expect(process.env.PORT).toBe('3001');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('KEYMASTER no definida'),
    );
  });

  it('termina con error si falta KEYMASTER y no hay .env', () => {
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env.enc'));

    expect(() => loadEncryptedEnv()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('cae a .env si KEYMASTER es incorrecta', () => {
    process.env.KEYMASTER = 'wrong-key';
    existsSyncMock.mockImplementation(
      (p: string) => p.endsWith('.env.enc') || p.endsWith('.env'),
    );
    readFileSyncMock.mockImplementation((p: string) =>
      p.endsWith('.env.enc') ? ENV_ENC : ENV_PLAIN,
    );

    loadEncryptedEnv();

    expect(process.env.PORT).toBe('3001');
  });

  it('termina con error si KEYMASTER es incorrecta y no hay .env', () => {
    process.env.KEYMASTER = 'wrong-key';
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env.enc'));

    expect(() => loadEncryptedEnv()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

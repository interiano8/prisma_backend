import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  validateLicense,
  ensureLicense,
  enrollWithServer,
  phoneHome,
  licensePaths,
} from '../../src/infrastructure/licensing/license';

const MACHINE_ID = 'AB12-CD34-EF56-7890';
const SERVER = 'https://lic.example.test';

describe('Licencia del backend POS', () => {
  let privateKey: string;
  let publicKey: string;
  let tmpDir: string;

  beforeAll(() => {
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = priv;
    publicKey = pub;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const signLicense = (machineId: string, issuedTo: string, expiresUtc: string): string => {
    const data = Buffer.from(`${machineId}|${issuedTo}|${expiresUtc}`, 'utf8');
    const signature = crypto.sign('RSA-SHA256', data, privateKey).toString('base64');
    return JSON.stringify({ machineId, issuedTo, expiresUtc, signature });
  };

  const writeLicense = (content: string): string => {
    const p = path.join(tmpDir, `license-${Math.random().toString(36).slice(2)}.key`);
    fs.writeFileSync(p, content);
    return p;
  };

  const opts = () => ({ publicKey, machineId: MACHINE_ID });

  it('acepta una licencia válida para esta máquina', () => {
    const p = writeLicense(signLicense(MACHINE_ID, 'Cliente', ''));
    expect(validateLicense(p, opts()).ok).toBe(true);
  });

  it('rechaza licencia de otra máquina', () => {
    const p = writeLicense(signLicense('ZZ99-0000-0000-0000', 'Cliente', ''));
    const r = validateLicense(p, opts());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('otra máquina');
  });

  it('rechaza licencia vencida', () => {
    const p = writeLicense(signLicense(MACHINE_ID, 'Cliente', '2020-01-01T00:00:00Z'));
    const r = validateLicense(p, opts());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('vencida');
  });

  it('rechaza firma inválida', () => {
    const p = writeLicense(
      JSON.stringify({
        machineId: MACHINE_ID,
        issuedTo: 'Cliente',
        expiresUtc: '',
        signature: Buffer.from('no-es-firma').toString('base64'),
      }),
    );
    const r = validateLicense(p, opts());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Firma');
  });

  it('rechaza archivo ausente', () => {
    const r = validateLicense(path.join(tmpDir, 'no-existe.key'), opts());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('license.key');
  });

  it('rechaza JSON corrupto', () => {
    const p = writeLicense('esto-no-es-json');
    expect(validateLicense(p, opts()).ok).toBe(false);
  });
});

describe('ensureLicense (gate + bypass)', () => {
  let dir: string;
  const ORIG = { ...process.env };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-gate-'));
    process.env.LICENSING_DIR = dir;
    delete process.env.LICENSING_SERVER_URL;
    delete process.env.WAYNE_SKIP_LICENSE;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIG };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('bypass en desarrollo no aborta', async () => {
    process.env.WAYNE_SKIP_LICENSE = '1';
    process.env.NODE_ENV = 'development';
    const spy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await ensureLicense();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('en producción el bypass SE IGNORA y falla sin licencia', async () => {
    process.env.WAYNE_SKIP_LICENSE = '1';
    process.env.NODE_ENV = 'production';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await ensureLicense();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('sin servidor y sin licencia: sale con error y escribe machine-id.txt', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await ensureLicense();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fs.existsSync(path.join(dir, 'machine-id.txt'))).toBe(true);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('enrollWithServer + phoneHome', () => {
  let dir: string;
  const ORIG = { ...process.env };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-enroll-'));
    process.env.LICENSING_DIR = dir;
    process.env.LICENSING_POLL_MS = '20';
    process.env.LICENSING_ENROLL_MAX_ATTEMPTS = '1';
    jest.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIG };
    fs.rmSync(dir, { recursive: true, force: true });
    // @ts-expect-error limpiar fetch mockeado
    delete global.fetch;
  });

  it('enrola y guarda la licencia cuando la nube la entrega', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/enroll')) return { ok: true, json: async () => ({ ok: true }) } as never;
      return { ok: true, json: async () => ({ license: { machineId: 'X', signature: 'S' } }) } as never;
    }) as never;

    await enrollWithServer(SERVER, licensePaths());

    expect(fs.existsSync(path.join(dir, 'license.key'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'license-state.json'), 'utf8')).status).toBe('active');
    expect(fs.existsSync(path.join(dir, 'device.key'))).toBe(true);
  });

  it('sin internet en el enrolamiento: sale con error', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as never;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await enrollWithServer(SERVER, licensePaths());

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('phoneHome: ok / suspended / revoked / unreachable', async () => {
    fs.writeFileSync(path.join(dir, 'license.key'), JSON.stringify({ machineId: 'X', signature: 'S' }));
    const paths = licensePaths();

    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true, nextRevalidateSeconds: 120 }) }) as never);
    expect(await phoneHome(SERVER, paths)).toEqual({ verdict: 'ok', nextRevalidateSeconds: 120 });

    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ revoked: true }) }) as never);
    expect(await phoneHome(SERVER, paths)).toEqual({ verdict: 'revoked' });

    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ suspended: true }) }) as never);
    expect(await phoneHome(SERVER, paths)).toEqual({ verdict: 'suspended' });

    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as never;
    expect(await phoneHome(SERVER, paths)).toEqual({ verdict: 'unreachable' });
  });
});

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { LICENSE_PUBLIC_KEY } from './public-key';

/** Payload firmado por el keygen/nube: machineId|issuedTo|expiresUtc */
function buildPayload(
  machineId: string,
  issuedTo: string,
  expiresUtc: string,
): string {
  return `${machineId}|${issuedTo}|${expiresUtc}`;
}

/** Formatea el hash a AB12-CD34-EF56-7890 (primeros 8 bytes). */
function formatMachineId(hex: string): string {
  const clean = hex.padStart(16, '0').slice(0, 16).toUpperCase();
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
}

/**
 * Fingerprint de la máquina (cross-platform), con scope de producto para que
 * distintas apps en la misma máquina no colisionen. Usa el machine-id del SO
 * (MachineGuid / node-machine-id) + el UUID de la placa (SMBIOS/DMI del firmware).
 * NO se usa la MAC: con varios adaptadores (WiFi/ethernet/USB) cambiaría el id sin
 * razón. Un disco clonado lee el UUID del firmware del equipo destino (distinto) →
 * el clon no hereda la licencia del original.
 */
function cmdOut(cmd: string): string | null {
  try {
    return require('child_process')
      .execSync(cmd, { encoding: 'utf8', windowsHide: true, timeout: 4000 })
      .trim();
  } catch {
    return null;
  }
}

function boardUuid(): string | null {
  try {
    if (process.platform === 'win32') {
      const out = cmdOut('wmic csproduct get uuid /value');
      const m = /UUID=([0-9A-Fa-f-]{36})/.exec(out ?? '');
      return m ? m[1].toUpperCase() : null;
    }
    for (const f of ['/sys/class/dmi/id/product_uuid', '/sys/class/dmi/id/board_serial']) {
      if (fs.existsSync(f)) {
        const v = fs.readFileSync(f, 'utf8').trim();
        if (v) return v;
      }
    }
    return null;
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
function rawFingerprint(): string {
  if (cachedRaw) return cachedRaw;
  const so = (() => {
    try {
      return machineIdSync();
    } catch {
      return undefined;
    }
  })();
  const parts = [so, boardUuid()].filter((v): v is string => !!v);
  cachedRaw = parts.length > 0
    ? parts.join('|')
    : `${process.env.COMPUTERNAME ?? 'unknown'}|${process.platform}`;
  return cachedRaw;
}

export function getMachineId(): string {
  return formatMachineId(
    crypto.createHash('sha256').update(`${rawFingerprint()}|PRISMA_BACKEND`).digest('hex'),
  );
}

export interface LicenseResult {
  ok: boolean;
  machineId: string;
  error: string;
}

export interface ValidateOptions {
  /** Clave pública PEM (por defecto la embebida). Los tests inyectan la propia. */
  publicKey?: string;
  /** Fingerprint a comparar (por defecto el real de la máquina). Los tests inyectan uno fijo. */
  machineId?: string;
}

/**
 * Valida license.key contra el fingerprint y la clave pública.
 */
export function validateLicense(
  licensePath: string,
  options: ValidateOptions = {},
): LicenseResult {
  const publicKey = options.publicKey ?? LICENSE_PUBLIC_KEY;
  const machineId = (options.machineId ?? getMachineId()).toUpperCase();

  if (!fs.existsSync(licensePath)) {
    return {
      ok: false,
      machineId,
      error: 'No se encontró el archivo de licencia (license.key).',
    };
  }

  let payload: {
    machineId?: string;
    issuedTo?: string;
    expiresUtc?: string;
    signature?: string;
  };
  try {
    payload = JSON.parse(fs.readFileSync(licensePath, 'utf8')) as {
      machineId?: string;
      issuedTo?: string;
      expiresUtc?: string;
      signature?: string;
    };
  } catch (err) {
    return {
      ok: false,
      machineId,
      error: `license.key no es JSON válido: ${(err as Error).message}`,
    };
  }

  if (!payload.machineId || !payload.signature) {
    return {
      ok: false,
      machineId,
      error: 'license.key incompleto (faltan machineId o signature).',
    };
  }

  if (payload.machineId.toUpperCase() !== machineId) {
    return {
      ok: false,
      machineId,
      error: `La licencia es para otra máquina. Machine ID de esta máquina: ${machineId}`,
    };
  }

  if (
    payload.expiresUtc &&
    new Date(payload.expiresUtc).getTime() < Date.now()
  ) {
    return { ok: false, machineId, error: 'Licencia vencida.' };
  }

  try {
    const data = Buffer.from(
      buildPayload(
        payload.machineId,
        payload.issuedTo ?? '',
        payload.expiresUtc ?? '',
      ),
      'utf8',
    );
    const signature = Buffer.from(payload.signature, 'base64');
    const verified = crypto.verify('RSA-SHA256', data, publicKey, signature);
    if (!verified) {
      return { ok: false, machineId, error: 'Firma inválida.' };
    }
  } catch (err) {
    return {
      ok: false,
      machineId,
      error: `No se pudo verificar la firma: ${(err as Error).message}`,
    };
  }

  return { ok: true, machineId, error: '' };
}

// ===== Enrolamiento + phone-home =====

/** Directorio de licencia (por defecto el cwd; `LICENSING_DIR` para tests). */
function licenseDir(): string {
  return process.env.LICENSING_DIR || process.cwd();
}

export function licensePaths(): {
  license: string;
  deviceKey: string;
  devicePub: string;
  state: string;
  machineId: string;
  log: string;
} {
  const dir = licenseDir();
  return {
    license: path.join(dir, 'license.key'),
    deviceKey: path.join(dir, 'device.key'),
    devicePub: path.join(dir, 'device.pub'),
    state: path.join(dir, 'license-state.json'),
    machineId: path.join(dir, 'machine-id.txt'),
    log: path.join(dir, 'license.log'),
  };
}

/** Escribe una línea en license.log (diagnóstico). */
function licLog(msg: string): void {
  try {
    fs.appendFileSync(
      licensePaths().log,
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch {
    // best-effort
  }
}

function serverUrl(): string {
  const v = (process.env.LICENSING_SERVER_URL ?? '').trim().replace(/\/+$/, '');
  if (v) return v;
  if (
    process.env.LICENSING_OFFLINE === '1' ||
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined
  ) {
    return '';
  }
  return 'https://licencias-api.prismapos.site';
}

function pollMs(): number {
  return Math.max(20, Number(process.env.LICENSING_POLL_MS ?? 10000));
}

function revalidateHours(): number {
  return Math.max(1, Number(process.env.LICENSING_REVALIDATE_HOURS ?? 5));
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function writeState(
  paths: ReturnType<typeof licensePaths>,
  status: string,
): void {
  try {
    fs.writeFileSync(
      paths.state,
      JSON.stringify({ status, at: new Date().toISOString() }),
    );
  } catch {
    // best-effort
  }
}

/** Genera (una vez) el par de llaves del dispositivo y devuelve la pública. */
function ensureDeviceKeypair(paths: ReturnType<typeof licensePaths>): string {
  if (fs.existsSync(paths.deviceKey) && fs.existsSync(paths.devicePub)) {
    return fs.readFileSync(paths.devicePub, 'utf8');
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(paths.deviceKey, privateKey, { mode: 0o600 });
  fs.writeFileSync(paths.devicePub, publicKey);
  return publicKey;
}

function fail(paths: ReturnType<typeof licensePaths>, error: string): void {
  try {
    fs.writeFileSync(paths.machineId, getMachineId());
  } catch {
    // best-effort
  }
  const msg =
    `${error} Machine ID: ${getMachineId()} (guardado en ${paths.machineId}). ` +
    'El backend NO puede iniciar sin licencia válida. ' +
    'Revise el archivo license.log y el panel de licencias.';
  licLog(`FALLO DE LICENCIA: ${msg}`);
  console.error(`[LICENSE] ${msg}`);
  process.exit(1);
}

export interface StoreContext {
  storeId: string | null;
  storeName: string | null;
  clientCode: string | null;
}

/**
 * Lee el contexto (tienda/cliente) de la BD `prisma` para el enrolamiento.
 * Usa una conexión corta (el gate corre antes de Nest). Si la BD no responde,
 * cae a las variables de entorno.
 */
export async function readStoreContext(): Promise<StoreContext> {
  const fallback: StoreContext = {
    storeId: process.env.STORE_ID ?? null,
    storeName: process.env.STORE_NAME ?? null,
    clientCode:
      process.env.LICENSING_CLIENT_CODE ?? process.env.CLIENT_CODE ?? null,
  };
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const { Pool } = await import('pg');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('../../generated/prisma/client.js');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      const sel = process.env.STORE_ID;
      const store = sel
        ? await prisma.tienda.findUnique({ where: { idTienda: sel } })
        : await prisma.tienda.findFirst({ orderBy: { idTienda: 'asc' } });
      if (!store) return fallback;
      return {
        storeId: store.idTienda ?? fallback.storeId,
        storeName: store.nombre ?? fallback.storeName,
        clientCode: store.casaMatriz ?? fallback.clientCode,
      };
    } finally {
      await prisma.$disconnect().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  } catch {
    return fallback;
  }
}

/**
 * Enrolamiento (primer arranque, obligatorio online): genera identidad, registra
 * la solicitud y espera la licencia firmada por la nube (aprobación manual).
 */
export async function enrollWithServer(
  server: string,
  paths: ReturnType<typeof licensePaths>,
): Promise<void> {
  const machineId = getMachineId();
  const publicKey = ensureDeviceKeypair(paths);

  let enrolled = false;
  try {
    const ctx = await readStoreContext();
    const res = await fetch(`${server}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId,
        publicKey,
        product: 'PRISMA_BACKEND',
        clientCode: ctx.clientCode,
        storeName: ctx.storeName,
        storeId: ctx.storeId,
        posNo: process.env.POS_NO ?? null,
      }),
    });
    enrolled = res.ok;
  } catch {
    enrolled = false;
  }
  if (!enrolled) {
    licLog(
      'ENROLAMIENTO FALLIDO: no se pudo contactar el servidor de licencias. ' +
        `URL: ${server}. Machine ID: ${machineId}.`,
    );
    fail(
      paths,
      'Se requiere internet para activar el POS (enrolamiento en la nube).',
    );
    return;
  }

  writeState(paths, 'pending');
  licLog(`Solicitud de activación enviada (machine ${machineId}). Pendiente de aprobación.`);
  console.log(
    `[LICENSE] Solicitud de activación enviada (machine ${machineId}). Pendiente de aprobación.`,
  );

  const maxAttempts = Number(process.env.LICENSING_ENROLL_MAX_ATTEMPTS ?? 0);
  const wait = pollMs();
  for (let i = 0; maxAttempts === 0 || i < maxAttempts; i++) {
    await delay(wait);
    try {
      const res = await fetch(
        `${server}/license?machineId=${encodeURIComponent(machineId)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          license?: unknown;
          revoked?: boolean;
          suspended?: boolean;
        };
        if (data?.revoked) {
          fail(paths, 'La solicitud de activación fue rechazada.');
          return;
        }
        if (data?.suspended) {
          fail(paths, 'La solicitud de activación está suspendida.');
          return;
        }
        if (data?.license) {
          fs.writeFileSync(paths.license, JSON.stringify(data.license));
          writeState(paths, 'active');
          licLog('Licencia recibida y guardada.');
          console.log('[LICENSE] Licencia recibida y guardada.');
          return;
        }
      }
    } catch {
      // sin contacto: reintentar
    }
    console.log('[LICENSE] Pendiente de aprobación...');
  }
  fail(paths, 'La activación no fue aprobada a tiempo.');
}

export interface PhoneHomeResult {
  verdict: 'ok' | 'suspended' | 'revoked' | 'notFound' | 'unreachable';
  nextRevalidateSeconds?: number;
}

/**
 * Phone-home best-effort. Devuelve el veredicto del servidor + el heartbeat;
 * NUNCA lanza.
 */
export async function phoneHome(
  server: string,
  paths: ReturnType<typeof licensePaths>,
): Promise<PhoneHomeResult> {
  try {
    const license = JSON.parse(fs.readFileSync(paths.license, 'utf8'));
    const res = await fetch(`${server}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: getMachineId(), license }),
    });
    if (!res.ok) return { verdict: 'unreachable' };
    const data = (await res.json()) as {
      ok?: boolean;
      revoked?: boolean;
      suspended?: boolean;
      notFound?: boolean;
      nextRevalidateSeconds?: number;
    };
    if (data?.revoked) return { verdict: 'revoked' };
    if (data?.suspended) return { verdict: 'suspended' };
    if (data?.notFound) return { verdict: 'notFound' };
    if (data?.ok) {
      return {
        verdict: 'ok',
        nextRevalidateSeconds: data.nextRevalidateSeconds,
      };
    }
    return { verdict: 'unreachable' };
  } catch {
    return { verdict: 'unreachable' };
  }
}

/** Bloquea la app (suspensión/revocación). */
function block(reason: string): never {
  licLog(`BLOQUEO: ${reason}. El backend se detendrá.`);
  console.error(`[LICENSE] ${reason} El backend se detendrá.`);
  process.exit(1);
  throw new Error(reason);
}

let revalidationTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Revalida periódicamente usando el heartbeat que define el servidor en cada
 * validación. Suspensión/revocación detienen el backend; si no hay contacto,
 * se reintenta con el último intervalo conocido (no castigador).
 */
export function startRevalidation(
  server: string,
  paths: ReturnType<typeof licensePaths>,
): void {
  if (revalidationTimer) return;

  const schedule = (seconds: number) => {
    revalidationTimer = setTimeout(async () => {
      const result = await phoneHome(server, paths);
      if (result.verdict === 'revoked') block('Licencia revocada por el servidor.');
      if (result.verdict === 'suspended')
        block('Licencia suspendida por el servidor.');
      if (result.verdict === 'notFound') {
        // Eliminada en la nube: re-enrolar como la primera vez (pide aprobación).
        licLog('La licencia ya no existe en la nube; re-enrolamiento como la primera vez.');
        console.warn(
          '[LICENSE] La licencia ya no existe en la nube. Re-enrolamiento...',
        );
        try {
          fs.unlinkSync(paths.license);
        } catch {
          // sin archivo
        }
        writeState(paths, 're-enrolling');
        await enrollWithServer(server, paths);
      }
      const next =
        result.nextRevalidateSeconds && result.nextRevalidateSeconds > 0
          ? result.nextRevalidateSeconds
          : seconds;
      schedule(next);
    }, Math.max(5, seconds) * 1000);
    revalidationTimer.unref?.();
  };

  schedule(revalidateHours() * 3600);
}

/**
 * Gate de arranque. Bypass `WAYNE_SKIP_LICENSE=1` solo fuera de producción.
 * Enrola si hay servidor y no hay licencia (exige internet); valida offline;
 * phone-home best-effort (no bloquea salvo `revoked`).
 */
export async function ensureLicense(): Promise<void> {
  if (!isProduction() && process.env.WAYNE_SKIP_LICENSE === '1') {
    console.warn(
      '[LICENSE] Bypass de desarrollo activo (WAYNE_SKIP_LICENSE=1).',
    );
    return;
  }

  const paths = licensePaths();
  const server = serverUrl();
  licLog(
    `--- Inicio de validación de licencia (servidor: ${server || '(sin servidor)'}) ---`,
  );

  if (!fs.existsSync(paths.license)) {
    if (server) {
      await enrollWithServer(server, paths);
    } else {
      fail(paths, 'No se encontró el archivo de licencia (license.key).');
      return;
    }
  }

  if (!fs.existsSync(paths.license)) return;

  const result = validateLicense(paths.license);
  if (!result.ok) {
    licLog(`VALIDACIÓN LOCAL FALLÓ: ${result.error}`);
    fail(paths, result.error);
    return;
  }

  licLog(`Licencia válida para máquina ${result.machineId}.`);
  console.log(
    `[LICENSE] Licencia válida para máquina ${result.machineId} (server=${server ? 'on' : 'off'}).`,
  );

  if (server) {
    const result = await phoneHome(server, paths);
    if (result.verdict === 'revoked')
      block('Licencia revocada por el servidor.');
    if (result.verdict === 'suspended')
      block('Licencia suspendida por el servidor.');
    if (result.verdict === 'notFound') {
      // El dispositivo fue eliminado en la nube: reactivar como la primera vez.
      licLog('La licencia ya no existe en la nube; re-enrolamiento como la primera vez.');
      console.warn(
        '[LICENSE] La licencia ya no existe en la nube. Re-enrolamiento como la primera vez...',
      );
      try {
        fs.unlinkSync(paths.license);
      } catch {
        // sin archivo
      }
      writeState(paths, 're-enrolling');
      await enrollWithServer(server, paths);
    }
    startRevalidation(server, paths);
  }
}

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

function loadNormalEnv(): void {
  const normalPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(normalPath)) return;
  try {
    const envContent = fs.readFileSync(normalPath, 'utf8');
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const k = trimmed.substring(0, index).trim();
        const v = trimmed.substring(index + 1).trim();
        const cleanVal = v.replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) {
          process.env[k] = cleanVal;
        }
      }
    }
  } catch {
    // Ignore
  }
}

function decryptEnv(masterKey: string): Record<string, string> {
  const encPath = path.join(process.cwd(), '.env.enc');
  const encryptedData = fs.readFileSync(encPath, 'utf8');
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted env file format.');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');

  // Derive a 32-byte key from the masterKey (using sha256)
  const key = crypto.createHash('sha256').update(masterKey).digest();

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  const result: Record<string, string> = {};
  const lines = decrypted.toString('utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index > 0) {
      const k = trimmed.substring(0, index).trim();
      const v = trimmed.substring(index + 1).trim();
      result[k] = v.replace(/^['"]|['"]$/g, '');
    }
  }
  return result;
}

export function loadEncryptedEnv() {
  const encPath = path.join(process.cwd(), '.env.enc');

  if (fs.existsSync(encPath)) {
    const masterKey = process.env.KEYMASTER;

    if (!masterKey) {
      // Sin KEYMASTER: en desarrollo usamos .env en texto plano si existe.
      if (fs.existsSync(path.join(process.cwd(), '.env'))) {
        console.warn(
          'KEYMASTER no definida: usando .env en texto plano (solo desarrollo).',
        );
        loadNormalEnv();
        return;
      }
      console.error(
        'ERROR: Found .env.enc but KEYMASTER environment variable is not defined!',
      );
      process.exit(1);
    }

    try {
      const env = decryptEnv(masterKey);
      for (const [k, v] of Object.entries(env)) {
        if (!process.env[k]) process.env[k] = v;
      }
      console.log('Successfully decrypted and loaded .env.enc');
    } catch (err) {
      // KEYMASTER incorrecta: en desarrollo caemos a .env si existe.
      if (fs.existsSync(path.join(process.cwd(), '.env'))) {
        console.warn(
          'KEYMASTER incorrecta para .env.enc: usando .env en texto plano (solo desarrollo).',
        );
        loadNormalEnv();
        return;
      }
      console.error(
        'ERROR: Failed to decrypt .env.enc. Please check if KEYMASTER is correct.',
        err,
      );
      process.exit(1);
    }
  } else {
    loadNormalEnv();
  }
}

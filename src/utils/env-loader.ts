import * as fs from 'fs';
import * as path from 'path';

/**
 * Carga las variables de entorno del archivo .env en texto plano.
 * (Se eliminó el soporte de .env.enc / KEYMASTER: los secretos van en .env
 * o en variables de entorno del servicio; la licencia protege el backend.)
 */
export function loadEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed
          .substring(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    // Ignorar: si .env no se puede leer, las variables ya definidas prevalecen.
  }
}

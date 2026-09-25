import { defineConfig } from 'prisma/config';
import * as fs from 'fs';
import * as path from 'path';

// Carga tolerante de variables de entorno para el CLI de Prisma.
// Prisma v7 ya no carga .env automáticamente. A diferencia del loader de la
// app, aquí no hacemos process.exit: `prisma generate` no necesita DATABASE_URL.
// (Se eliminó el soporte de .env.enc / KEYMASTER.)
function loadEnv(): void {
  const setIfMissing = (k: string, v: string) => {
    if (!process.env[k]) process.env[k] = v.replace(/^['"]|['"]$/g, '');
  };

  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) setIfMissing(t.slice(0, i).trim(), t.slice(i + 1).trim());
    }
  }
}

loadEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` no requiere conexión; solo `migrate`/`db` necesitan URL.
    url: process.env.DATABASE_URL ?? '',
    shadowDatabaseUrl:
      process.env.SHADOW_DATABASE_URL ??
      'postgresql://postgres@127.0.0.1:5432/prisma_shadow',
  },
});
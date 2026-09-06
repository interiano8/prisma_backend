export default function globalSetup(): void {
  process.env.DATABASE_URL =
    process.env.E2E_DATABASE_URL ??
    process.env.E2E_DATABASE_URL_OVERRIDE ??
    'postgresql://postgres@127.0.0.1:5432/prisma_e2e';
  process.env.ADMIN_MASTER_PASSWORD =
    process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin';
}
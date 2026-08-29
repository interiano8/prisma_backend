// prisma/seed.ts — No-op (base de datos en vivo, no se siembra).
async function main() {
  console.log('Skipping database seeding for live SQL Server environment.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Establece la contraseña de administrador de la tienda en la base de datos.
// Hash ASP.NET Identity V3 (PBKDF2-HMAC-SHA256), igual que src/infrastructure/security/hash-utils.ts
const crypto = require('crypto');
const { Client } = require('pg');

const STORE_ID = process.argv[2] || '001';
const PASSWORD = process.argv[3] || 'admin123';

function hashPassword(password) {
  const prf = 1;
  const iterations = 100000;
  const saltLength = 16;
  const subkeyLength = 32;
  const salt = crypto.randomBytes(saltLength);
  const subkey = crypto.pbkdf2Sync(password, salt, iterations, subkeyLength, 'sha256');
  const buf = Buffer.alloc(17 + saltLength + subkeyLength);
  buf[0] = 0x01;
  buf.writeInt32BE(prf, 1);
  buf.writeInt32BE(iterations, 5);
  buf.writeInt32BE(saltLength, 9);
  buf.writeInt32BE(subkeyLength, 13);
  salt.copy(buf, 17);
  subkey.copy(buf, 17 + saltLength);
  return buf.toString('base64');
}

async function main() {
  const hash = hashPassword(PASSWORD);
  const client = new Client({ connectionString: 'postgresql://postgres@127.0.0.1:5432/prisma' });
  await client.connect();

  const res = await client.query(
    `UPDATE tiendas SET contrasena_admin = $1 WHERE id_tienda = $2 RETURNING id_tienda`,
    [hash, STORE_ID],
  );
  if (res.rowCount === 0) {
    throw new Error(`Tienda ${STORE_ID} no encontrada`);
  }

  console.log(`Contraseña admin de tienda ${STORE_ID} establecida (por defecto: ${PASSWORD})`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
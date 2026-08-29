// Crea un usuario de prueba con contraseña conocida para poder entrar al POS.
// Hash ASP.NET Identity V3 (PBKDF2-HMAC-SHA256), igual que src/auth/hash-utils.ts
const crypto = require('crypto');
const { Client } = require('pg');

const USUARIO = process.argv[2] || 'prueba';
const PASSWORD = process.argv[3] || '1234';

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

  await client.query(
    `INSERT INTO empleados (usuario, nombre, perfil, esta_activo, hash_contrasena)
     VALUES ($1, $2, 'Admin', true, $3)
     ON CONFLICT (usuario) DO UPDATE SET hash_contrasena = EXCLUDED.hash_contrasena, esta_activo = true`,
    [USUARIO, USUARIO, hash],
  );

  console.log(`Usuario creado: ${USUARIO} / ${PASSWORD} (perfil Admin, activo)`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

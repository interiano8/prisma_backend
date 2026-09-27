// prisma_backend/scripts/seed-pos-local.js
// Siembra datos iniciales para el POS Local en Docker (idempotente)
const crypto = require('crypto');
const { Client } = require('pg');

function hashPassword(password) {
  const prf = 1; // HMAC-SHA256
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
  const dbUrl = process.env.DATABASE_URL || 'postgresql://pos_user:pos_secret_password@postgres-pos-local:5432/prisma?schema=public';
  console.log('[SEED POS] Conectando a PostgreSQL POS...');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1. Tienda Local 001
    await client.query(`
      INSERT INTO tiendas (id_tienda, nombre, emisor, turnos)
      VALUES ('001', 'Estación Central 001', '001', 3)
      ON CONFLICT (id_tienda) DO UPDATE SET nombre = EXCLUDED.nombre;
    `);
    console.log('[SEED POS] Tienda 001 registrada.');

    // 2. Monedas
    await client.query(`
      INSERT INTO monedas (codigo, descripcion, simbolo, decimales, activa)
      VALUES 
        ('HNL', 'Lempira', 'L', 2, true),
        ('USD', 'Dólar Estadounidense', '$', 2, true)
      ON CONFLICT (codigo) DO NOTHING;
    `);
    console.log('[SEED POS] Monedas HNL y USD registradas.');

    // 3. Empleados de prueba (admin / 1234, cajero / 1234)
    const hashAdmin = hashPassword('1234');
    const hashCajero = hashPassword('1234');

    await client.query(`
      INSERT INTO empleados (usuario, nombre, perfil, esta_activo, hash_contrasena)
      VALUES 
        ('admin', 'Administrador Local', 'Admin', true, $1),
        ('cajero', 'Cajero Turno 1', 'Cajero', true, $2)
      ON CONFLICT (usuario) DO UPDATE 
        SET hash_contrasena = EXCLUDED.hash_contrasena, esta_activo = true;
    `, [hashAdmin, hashCajero]);
    console.log('[SEED POS] Empleados creados: admin / 1234 y cajero / 1234.');

    // 4. Roles RBAC
    await client.query(`
      INSERT INTO roles (id, nombre, descripcion, esta_activo, es_sistema)
      VALUES 
        ('ADMIN', 'Administrador', 'Control total del sistema POS', true, true),
        ('CAJERO', 'Cajero', 'Operación de turnos y facturación', true, false)
      ON CONFLICT (id) DO NOTHING;
    `).catch(() => {});

    // Asignar roles
    await client.query(`
      INSERT INTO empleado_roles (id_empleado, id_rol)
      SELECT id, 'ADMIN' FROM empleados WHERE usuario = 'admin'
      ON CONFLICT DO NOTHING;
    `).catch(() => {});

    await client.query(`
      INSERT INTO empleado_roles (id_empleado, id_rol)
      SELECT id, 'CAJERO' FROM empleados WHERE usuario = 'cajero'
      ON CONFLICT DO NOTHING;
    `).catch(() => {});

    // 5. Configuración POS
    await client.query(`
      INSERT INTO configuracion_pos (codigo_pos, mostrar_bombas, num_transacciones_bombas, declarar_montos_iniciales, visualizacion)
      VALUES ('POS01', true, 10, true, 'DEFAULT')
      ON CONFLICT (codigo_pos) DO NOTHING;
    `).catch(() => {});
    console.log('[SEED POS] Configuración POS01 registrada.');

    // 6. Series de Facturación SAR
    await client.query(`
      INSERT INTO series_documento (
        numero_linea, codigo_serie, cai, rango_desde, rango_hasta, 
        numero_inicio, numero_fin, ultimo_numero_usado, abierta, fecha_vence_rango
      )
      VALUES (
        1, 'FAC-001', '3A7B9C-1F2E3D-4A5B6C-7D8E9F-01',
        '001-001-01-00000001', '001-001-01-00100000',
        '00000001', '00100000', '00000000', true, '2028-12-31'
      )
      ON CONFLICT (numero_linea, codigo_serie) DO NOTHING;
    `).catch(() => {});
    console.log('[SEED POS] Serie de facturación SAR lista.');

    // 7. Productos y Combustibles
    await client.query(`
      INSERT INTO productos (codigo, descripcion, grupo_isv, codigo_moneda)
      VALUES 
        ('SUPER', 'Gasolina Súper 95 Oct', 'EXENTO', 'HNL'),
        ('REGULAR', 'Gasolina Regular 91 Oct', 'EXENTO', 'HNL'),
        ('DIESEL', 'Diésel Bajo Azufre', 'EXENTO', 'HNL')
      ON CONFLICT (codigo) DO NOTHING;
    `).catch(() => {});

    // 8. Mangueras y Precios
    await client.query(`
      INSERT INTO mangueras (
        id_manguera, numero_grado, nombre_grado, precio_unitario,
        id_bomba, pos, codigo_pos, visible, codigo_moneda
      )
      VALUES 
        (1, 1, 'Gasolina Súper', 105.50, 1, '1', 'POS01', true, 'HNL'),
        (2, 2, 'Gasolina Regular', 98.20, 1, '1', 'POS01', true, 'HNL'),
        (3, 3, 'Diésel Extra', 89.00, 2, '2', 'POS01', true, 'HNL'),
        (4, 1, 'Gasolina Súper', 105.50, 2, '2', 'POS01', true, 'HNL')
      ON CONFLICT (id_manguera) DO NOTHING;
    `).catch(() => {});
    console.log('[SEED POS] Mangueras y combustibles inicializados.');

    // 9. Cliente Genérico (Consumidor Final)
    await client.query(`
      INSERT INTO clientes (codigo, nombre, rtn, bloqueado)
      VALUES ('000000', 'Consumidor Final', '99999999999999', false)
      ON CONFLICT (codigo) DO NOTHING;
    `).catch(() => {});
    console.log('[SEED POS] Cliente Consumidor Final listo.');

    console.log('[SEED POS] Inicialización de POS Local finalizada con éxito.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[SEED POS] Error en la inicialización:', err);
  process.exit(1);
});

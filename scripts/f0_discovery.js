/*
 * F0 — Descubrimiento de esquema SQL Server (TPV + FusionController)
 * Extrae: tablas, columnas, PKs, FKs, índices, vistas, stored procedures
 * (con su definición), conteo de filas y tamaño, para ambas bases.
 * Salida: f0_out/*.json
 */
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function parseDbUrl(url) {
  // sqlserver://host:port;database=NAME;user=U;password=P;trustServerCertificate=true;
  const m = url.match(/^sqlserver:\/\/([^:;]+)(?::(\d+))?;(.+)$/s);
  if (!m) throw new Error('Cannot parse DATABASE_URL');
  const server = m[1];
  const port = m[2] ? parseInt(m[2], 10) : 1433;
  const params = {};
  for (const part of m[3].split(';')) {
    const i = part.indexOf('=');
    if (i > 0) params[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return {
    server,
    port,
    user: params.user,
    password: params.password,
    database: params.database,
    options: { trustServerCertificate: true, encrypt: false },
    pool: { max: 5 },
    connectionTimeout: 20000,
    requestTimeout: 120000,
  };
}

async function main() {
  const env = parseEnv(path.join(__dirname, '..', '.env'));
  const config = parseDbUrl(env.MSSQL_URL || env.DATABASE_URL);
  console.log(`Conectando a ${config.server}:${config.port} (base ${config.database}) ...`);
  const pool = await sql.connect(config);

  const outDir = path.join(__dirname, '..', 'f0_out');
  fs.mkdirSync(outDir, { recursive: true });

  // ===== TPV (base actual) =====
  const tpv = {};

  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_CATALOG = DB_NAME()
    ORDER BY TABLE_TYPE, TABLE_NAME`);
  tpv.tables = tables.recordset;

  const columns = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
           NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE, COLUMN_DEFAULT,
           COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA+'.'+TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY,
           ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_CATALOG = DB_NAME()
    ORDER BY TABLE_NAME, ORDINAL_POSITION`);
  tpv.columns = columns.recordset;

  const pks = await pool.request().query(`
    SELECT tc.TABLE_NAME, ccu.COLUMN_NAME, tc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
      ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME AND tc.TABLE_NAME = ccu.TABLE_NAME
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_CATALOG = DB_NAME()
    ORDER BY tc.TABLE_NAME, ccu.COLUMN_NAME`);
  tpv.primaryKeys = pks.recordset;

  const fks = await pool.request().query(`
    SELECT fk.name AS FK_NAME,
           OBJECT_NAME(fk.parent_object_id) AS FK_TABLE,
           COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS FK_COLUMN,
           OBJECT_NAME(fk.referenced_object_id) AS PK_TABLE,
           COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS PK_COLUMN
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    ORDER BY FK_TABLE`);
  tpv.foreignKeys = fks.recordset;

  const indexes = await pool.request().query(`
    SELECT OBJECT_NAME(i.object_id) AS TABLE_NAME, i.name AS INDEX_NAME,
           i.is_unique, i.is_primary_key, i.type_desc
    FROM sys.indexes i
    WHERE i.object_id IN (SELECT object_id FROM sys.tables)
      AND i.name IS NOT NULL
    ORDER BY TABLE_NAME, i.index_id`);
  tpv.indexes = indexes.recordset;

  const procs = await pool.request().query(`
    SELECT p.name, m.definition, p.create_date, p.modify_date
    FROM sys.procedures p
    JOIN sys.sql_modules m ON p.object_id = m.object_id
    ORDER BY p.name`);
  tpv.procedures = procs.recordset.map((p) => ({
    name: p.name,
    create_date: p.create_date,
    modify_date: p.modify_date,
    definition: p.definition,
  }));

  const rowCounts = await pool.request().query(`
    SELECT t.name AS table_name, SUM(p.rows) AS row_count
    FROM sys.tables t
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
    GROUP BY t.name
    ORDER BY row_count DESC`);
  tpv.rowCounts = rowCounts.recordset;

  const spaceUsed = await pool.request().query(`EXEC sp_spaceused`);
  tpv.spaceUsed = spaceUsed.recordset;

  const views = await pool.request().query(`
    SELECT TABLE_NAME, VIEW_DEFINITION
    FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_CATALOG = DB_NAME()`);
  tpv.views = views.recordset;

  fs.writeFileSync(path.join(outDir, 'tpv_schema.json'), JSON.stringify(tpv, null, 2));
  console.log(`TPV: ${tpv.tables.length} tablas, ${tpv.columns.length} columnas, ${tpv.procedures.length} SPs, ${tpv.views.length} vistas`);

  // ===== FusionController (otra base) =====
  const fusion = {};

  const fTables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM [FusionController].INFORMATION_SCHEMA.TABLES
    ORDER BY TABLE_TYPE, TABLE_NAME`);
  fusion.tables = fTables.recordset;

  const fColumns = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
           NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION
    FROM [FusionController].INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_NAME, ORDINAL_POSITION`);
  fusion.columns = fColumns.recordset;

  const fProcs = await pool.request().query(`
    SELECT p.name, m.definition, p.create_date, p.modify_date
    FROM [FusionController].sys.procedures p
    JOIN [FusionController].sys.sql_modules m ON p.object_id = m.object_id
    ORDER BY p.name`);
  fusion.procedures = fProcs.recordset.map((p) => ({
    name: p.name,
    create_date: p.create_date,
    modify_date: p.modify_date,
    definition: p.definition,
  }));

  const fRowCounts = await pool.request().query(`
    SELECT t.name AS table_name, SUM(p.rows) AS row_count
    FROM [FusionController].sys.tables t
    JOIN [FusionController].sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
    GROUP BY t.name
    ORDER BY row_count DESC`);
  fusion.rowCounts = fRowCounts.recordset;

  fs.writeFileSync(path.join(outDir, 'fusion_schema.json'), JSON.stringify(fusion, null, 2));
  console.log(`FusionController: ${fusion.tables.length} tablas, ${fusion.columns.length} columnas, ${fusion.procedures.length} SPs`);

  await pool.close();
  console.log('Listo. Salida en f0_out/');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

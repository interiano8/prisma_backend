/*
 * F3 — ETL: migra datos de SQL Server (TPV + FusionController) a PostgreSQL.
 * Usa el diccionario de nombres (scripts/f0_naming.js) como fuente de verdad.
 */
const mssql = require('mssql');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { tables, columns, booleanColumns, fusionTables, fusionColumns } = require('./f0_naming');

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
const env = parseEnv(path.join(__dirname, '..', '.env'));

const mssqlUrl = env.MSSQL_URL || env.DATABASE_URL;
const pgUrl = env.DATABASE_URL;

function parseMssql(url) {
  const m = url.match(/^sqlserver:\/\/([^:;]+)(?::(\d+))?;(.+)$/s);
  const params = {};
  for (const part of m[3].split(';')) {
    const i = part.indexOf('=');
    if (i > 0) params[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return {
    server: m[1],
    port: m[2] ? parseInt(m[2], 10) : 1433,
    user: params.user,
    password: params.password,
    database: params.database,
    options: { trustServerCertificate: true, encrypt: false },
    pool: { max: 5 },
    connectionTimeout: 20000,
    requestTimeout: 120000,
  };
}

function toBool(v) {
  if (v === null || v === undefined) return null;
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE' || v === 'True') return true;
  return false;
}

const timeColumns = new Set([
  'StoreShift.StartTime', 'StoreShift.EndTime',
  'StoreShiftConfiguration.startTime', 'StoreShiftConfiguration.endTime',
]);

function toTime(v) {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  if (typeof v === 'string') return v;
  return null;
}

// Transforma un valor según su columna
function transform(val, sourceTable, srcCol) {
  if (val === null || val === undefined) return null;
  const key = `${sourceTable}.${srcCol}`;
  if (booleanColumns.has(key)) return toBool(val);
  if (timeColumns.has(key)) return toTime(val);
  return val;
}

async function getTargetColumns(pg, tableName) {
  const r = await pg.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [tableName],
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function migrateTable(pg, mssqlPool, sourceTable, targetTable, colMap, crossDb) {
  const targetCols = await getTargetColumns(pg, targetTable);

  // Filtrar: solo columnas que existen en origen (las consultamos todas) y destino
  const pairs = Object.entries(colMap).filter(([, dst]) => targetCols.has(dst));
  if (pairs.length === 0) {
    console.log(`  ${sourceTable} -> ${targetTable}: sin columnas mapeables, omitido`);
    return { table: targetTable, rows: 0 };
  }

  const srcCols = pairs.map(([src]) => src);
  const dstCols = pairs.map(([, dst]) => dst);

  await pg.query(`TRUNCATE "${targetTable}" RESTART IDENTITY`);

  // SELECT con nombres entre corchetes (soporta espacios y caracteres especiales)
  const from = crossDb ? `[${crossDb}].[dbo].[${sourceTable}]` : `[${sourceTable}]`;
  const selectSql = `SELECT ${srcCols.map((c) => `[${c}]`).join(', ')} FROM ${from}`;
  let result;
  try {
    result = await mssqlPool.request().query(selectSql);
  } catch (e) {
    console.log(`  ${sourceTable}: ERROR lectura: ${e.message}`);
    return { table: targetTable, rows: 0 };
  }
  const rows = result.recordset || [];

  if (rows.length === 0) {
    console.log(`  ${sourceTable} -> ${targetTable}: 0 filas`);
    return { table: targetTable, rows: 0 };
  }

  const insertSql = `INSERT INTO "${targetTable}" (${dstCols.map((c) => `"${c}"`).join(', ')}) VALUES (${dstCols.map((_, i) => `$${i + 1}`).join(', ')})`;

  const BATCH = 1000;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk.map((row) => srcCols.map((src) => transform(row[src], sourceTable, src)));
    // Ejecutar en una sola transacción por batch
    await pg.query('BEGIN');
    try {
      for (const v of values) await pg.query(insertSql, v);
      await pg.query('COMMIT');
    } catch (e) {
      await pg.query('ROLLBACK');
      throw e;
    }
    count += chunk.length;
  }
  console.log(`  ${sourceTable} -> ${targetTable}: ${count} filas`);
  return { table: targetTable, rows: count };
}

async function resetSequences(pg, tablesWithExplicitId) {
  for (const t of tablesWithExplicitId) {
    try {
      const r = await pg.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [t]);
      const seq = r.rows[0].seq;
      if (!seq) continue;
      await pg.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${t}"), 1), true)`, [seq]);
    } catch (e) {
      console.log(`  (aviso) no se pudo reiniciar secuencia de ${t}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('Conectando a SQL Server...');
  const mssqlPool = await mssql.connect(parseMssql(mssqlUrl));
  console.log('Conectando a PostgreSQL...');
  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();

  const scope = [
    ...Object.keys(columns).map((t) => ({ source: t, target: tables[t].es, map: columns[t], crossDb: null })),
    ...Object.keys(fusionColumns).map((t) => ({ source: t, target: fusionTables[t].es, map: fusionColumns[t], crossDb: 'FusionController' })),
  ];

  const explicitIdTables = new Set();
  for (const item of scope) {
    // Si hay una columna mapeada a 'id' que no es auto-generada (existe en origen), la insertamos explícitamente
    if (Object.values(item.map).includes('id')) explicitIdTables.add(item.target);
  }

  const summary = [];
  for (const item of scope) {
    try {
      const res = await migrateTable(pg, mssqlPool, item.source, item.target, item.map, item.crossDb);
      summary.push(res);
    } catch (e) {
      console.log(`  ${item.source} -> ${item.target}: ERROR: ${e.message}`);
      summary.push({ table: item.target, rows: -1 });
    }
  }

  console.log('\nReiniciando secuencias de claves auto-generadas...');
  await resetSequences(pg, [...explicitIdTables]);

  await pg.end();
  await mssqlPool.close();

  console.log('\n=== Resumen ===');
  for (const s of summary) console.log(`${s.table}: ${s.rows}`);
  const total = summary.reduce((a, s) => a + (s.rows > 0 ? s.rows : 0), 0);
  console.log(`\nTotal filas migradas: ${total}`);
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});

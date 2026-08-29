/*
 * F0 — Genera docs/diccionario_datos.md y docs/inventario_stored_procedures.md
 * a partir de f0_out/*.json + f0_naming.js.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tpv = JSON.parse(fs.readFileSync(path.join(root, 'f0_out', 'tpv_schema.json'), 'utf8'));
const fusion = JSON.parse(fs.readFileSync(path.join(root, 'f0_out', 'fusion_schema.json'), 'utf8'));
const scope = JSON.parse(fs.readFileSync(path.join(root, 'f0_out', 'scope.json'), 'utf8'));
const { tables, columns, booleanColumns, fusionTables, fusionColumns } = require('./f0_naming');

const tpvTables = tpv.tables.filter((t) => t.TABLE_TYPE === 'BASE TABLE').map((t) => t.TABLE_NAME);
const rowCounts = {};
tpv.rowCounts.forEach((r) => (rowCounts[r.table_name] = r.row_count));

// ===== Conversión de tipos SQL Server -> PostgreSQL =====
function pgType(col, isBoolean) {
  if (isBoolean) return 'boolean';
  const t = (col.DATA_TYPE || '').toLowerCase();
  const len = col.CHARACTER_MAXIMUM_LENGTH;
  const p = col.NUMERIC_PRECISION;
  const s = col.NUMERIC_SCALE;
  switch (t) {
    case 'nvarchar':
    case 'varchar':
    case 'nchar':
    case 'char':
      if (len == null || len < 0 || len > 1024) return 'text';
      return `varchar(${len})`;
    case 'int': return 'integer';
    case 'bigint': return 'bigint';
    case 'smallint': return 'smallint';
    case 'tinyint': return 'smallint';
    case 'decimal':
    case 'numeric':
    case 'money':
    case 'smallmoney': {
      const prec = Math.min(p || 18, 18);
      const scale = Math.min(s == null ? 2 : s, 6);
      return `numeric(${prec},${scale})`;
    }
    case 'float':
    case 'real': return 'double precision';
    case 'datetime':
    case 'datetime2':
    case 'smalldatetime': return 'timestamptz';
    case 'date': return 'date';
    case 'time': return 'time';
    case 'bit': return 'boolean';
    case 'image': return 'bytea';
    case 'uniqueidentifier': return 'uuid';
    case 'text': return 'text';
    default: return t;
  }
}

// ===== Diccionario de datos =====
let md = `# Diccionario de datos — migración TPV → PostgreSQL

Generado automáticamente por \`scripts/f0_generate_docs.js\` desde el esquema real de SQL Server.

## Resumen

| | TPV | FusionController |
|---|---|---|
| Tablas (base) | ${tpvTables.length} | ${fusion.tables.length} |
| Columnas | ${tpv.columns.length} | ${fusion.columns.length} |
| Stored procedures | ${tpv.procedures.length} | ${fusion.procedures.length} |
| Vistas | ${tpv.views.length} | — |

- **Convención**: \`snake_case\` en español, tablas en plural.
- **Tamaño TPV**: ${(tpv.spaceUsed || []).map((r) => `${r.database_size || ''}`).join(' ')}
- Clasificación de tablas: **núcleo** (migrar), **fiscal**, **catálogo**, **surtidores**, **sorteos**, **log** (opcional), **temporal/legacy** (NO migrar).

## Hallazgos

1. \`POS_Sorteo\`, \`StoreConfig\` y \`MobileDispenser\` **NO existen** en la base actual, pero el backend las referencia (\`invoice-repository\`, \`sorteos-repository\`, modelo Prisma \`Dispenser\`). Son referencias muertas que fallan en silencio. En Postgres se crearán como tablas nuevas (\`ventas_sorteo\`, \`configuracion_tienda\`) o se eliminará el código.
2. Los modelos de \`schema.prisma\` (\`Shift\`, \`Invoice\`, \`InvoiceItem\`, \`Dispenser\`) están muertos; toda la persistencia real es SQL crudo.
3. Hay ~15 tablas \`Temp_*\` usadas como scratch por los SPs de reportes (cierre de turno). Se eliminan al reimplementar en NestJS.
4. \`FusionController\` es una base aparte (controlador de surtidores) con 4 tablas.

---

## Tablas núcleo (migrar)

`;
const tableOrder = [
  'Employee', 'Store', 'POS Closed Shift', 'TPV_config', 'Customer', 'Item', 'Sales Price',
  'Descuentos', 'Charge Method', 'LEAL', 'HoseFS', 'No_ Series', 'No_ Series Line',
  'POS Sales Header', 'POS Sales Line', 'POS Sales Charge Line', 'POSSalesHeaderLeal',
  'POS Transaction Log', 'POS Cash Entries', 'VAT Setup', 'Motivos', 'TasaCambio',
  'StoreShift', 'StoreShiftConfiguration', 'Item Category', 'FuelAttendant',
];

for (const t of tableOrder) {
  const info = tables[t];
  if (!info) continue;
  const cols = tpv.columns.filter((c) => c.TABLE_NAME === t);
  const rows = rowCounts[t] || 0;
  md += `### \`${t}\` → **${info.es}** _(~${rows} filas)_\n\n`;
  md += `| Columna original | Nueva | Tipo Postgres | Null |\n|---|---|---|---|\n`;
  for (const c of cols) {
    const mapped = columns[t] && columns[t][c.COLUMN_NAME];
    const es = mapped || slug(c.COLUMN_NAME);
    const isBool = booleanColumns.has(`${t}.${c.COLUMN_NAME}`);
    const type = pgType(c, isBool);
    md += `| \`${c.COLUMN_NAME}\` | \`${es}\` | ${type} | ${c.IS_NULLABLE === 'YES' ? 'sí' : 'no'} |\n`;
  }
  md += '\n';
}

// FusionController
md += `## FusionController (surtidores)\n\n`;
for (const t of fusion.tables) {
  if (t.TABLE_TYPE !== 'BASE TABLE') continue;
  const ft = fusionTables[t.TABLE_NAME] || { es: slug(t.TABLE_NAME) };
  const cols = fusion.columns.filter((c) => c.TABLE_NAME === t.TABLE_NAME);
  md += `### \`${t.TABLE_NAME}\` → **${ft.es}**\n\n`;
  md += `| Columna original | Nueva | Tipo Postgres | Null |\n|---|---|---|---|\n`;
  for (const c of cols) {
    const mapped = (fusionColumns[t.TABLE_NAME] || {})[c.COLUMN_NAME];
    const es = mapped || slug(c.COLUMN_NAME);
    const isBool = (t.TABLE_NAME === 'FusionSales' && c.COLUMN_NAME === 'IsInvoiced') || (t.TABLE_NAME === 'FuelSession' && c.COLUMN_NAME === 'WasFuelling');
    md += `| \`${c.COLUMN_NAME}\` | \`${es}\` | ${pgType(c, isBool)} | ${c.IS_NULLABLE === 'YES' ? 'sí' : 'no'} |\n`;
  }
  md += '\n';
}

// ===== Otras tablas por categoría =====
md += `## Tablas por categoría (resto)\n\n`;
const catLabels = {
  fiscal: 'Fiscal (migrar)',
  catalogo: 'Catálogo/referencia (migrar)',
  surtidores: 'Surtidores/controlador (migrar si se usan)',
  sorteos: 'Sorteos (migrar)',
  log: 'Logs (opcional)',
  temporal: 'Temporales/scratch (NO migrar)',
  legacy: 'Legacy/vacío (NO migrar)',
};
const byCat = {};
for (const [name, info] of Object.entries(tables)) {
  if (tableOrder.includes(name) && info.categoria === 'nucleo') continue;
  (byCat[info.categoria] = byCat[info.categoria] || []).push({ name, info });
}
for (const cat of Object.keys(catLabels)) {
  md += `### ${catLabels[cat]}\n\n| Tabla original | Nueva | Filas |\n|---|---|---|\n`;
  for (const { name, info } of byCat[cat] || []) {
    md += `| \`${name}\` | ${info.es ? `\`${info.es}\`` : '—'} | ${rowCounts[name] || 0} |\n`;
  }
  md += '\n';
}

fs.writeFileSync(path.join(root, 'docs', 'diccionario_datos.md'), md);
console.log('docs/diccionario_datos.md generado');

function slug(s) {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9ñáéíóúü _]+/gi, '')
    .replace(/[ _]+/g, '_')
    .replace(/^_|_$/g, '') || 'columna';
}

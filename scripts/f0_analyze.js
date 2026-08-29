/*
 * F0 — Análisis de alcance: qué tablas tocan los SPs que el backend llama.
 * Produce f0_out/scope.json con el cierre transitivo de tablas.
 */
const fs = require('fs');
const path = require('path');

const tpv = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'f0_out', 'tpv_schema.json'), 'utf8'));
const fusion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'f0_out', 'fusion_schema.json'), 'utf8'));

// 36 SPs reales que el backend invoca
const BACKEND_SPS = [
  'CloseShiftV2', 'CreateNewCustomer', 'EIInsertCreditNote', 'EIInsertInvoiceFullV1',
  'EIInsertSalesLine', 'EIInsertTicketFullV1', 'EINextCreditNotev2', 'EINextInvoice',
  'EINextPosTransactionIDNumber', 'GetAvailableDataForDate', 'GetDetailsCombustiblesV2',
  'GetDetailsImpuestosForPOS', 'GetDetailsOtherProducts', 'GetDetailsPaymentsMethod',
  'GetDetailsTicket', 'GetEntradaDolar', 'GetGranTotalTicket', 'GetHeaderInvoice',
  'GetHeaderInvoiceDetail', 'GetSalesByPumpNumber', 'GetSalidaLps', 'GetTotalCombustibles',
  'GetTotalDescuentos', 'GetTotalEfectivo-MovCaja', 'GetTotalInvoice', 'GetTotalOtherProducts',
  'GetTotalPaymentsMethod', 'GetTotalSale', 'GetTotalTicket',
  'GetUniquePumpNumbersWithEmployee', 'InsertPaymentMethods', 'OpenNewShift',
  'ReversarTransaccion', 'UpdateIsInvoiced', 'sp_CalcularTotalConDescuentoYISV',
  'sp_InsertarPOSSalesHeaderLeal',
];

const procByName = {};
for (const p of tpv.procedures) procByName[p.name] = p.definition;

// FusionController SPs
const fusionProcByName = {};
for (const p of fusion.procedures) fusionProcByName[p.name] = p.definition;

const allTables = new Set(
  tpv.tables.filter((t) => t.TABLE_TYPE === 'BASE TABLE').map((t) => t.TABLE_NAME),
);

function extractRefs(def) {
  const tables = new Set();
  const procs = new Set();
  if (!def) return { tables, procs };

  // Referencias a tablas: [schema].[tabla] o [tabla] tras FROM/JOIN/INTO/UPDATE/INSERT
  const tblRe = /(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+(?:\[?[A-Za-z_][A-Za-z0-9_]*\]?\.)?(?:\[?dbo\]?\.)?(\[?[A-Za-z_0-9 #()]+\]?)/gi;
  let m;
  while ((m = tblRe.exec(def)) !== null) {
    let name = m[1].replace(/[\[\]]/g, '').trim();
    if (/^\w+$/.test(name) || name.includes(' ')) tables.add(name);
  }

  // Llamadas a otros SPs (EXEC)
  const procRe = /EXEC\s+(?:\[?[A-Za-z_][A-Za-z0-9_]*\]?\.)?(?:\[?dbo\]?\.)?\[?([A-Za-z_][A-Za-z0-9_]*)\]?/gi;
  let p;
  while ((p = procRe.exec(def)) !== null) procs.add(p[1]);

  return { tables, procs };
}

// Mapa: SP -> tablas directas + SPs internos
const direct = {};
const queue = [...BACKEND_SPS];
const visited = new Set();
const reachableTables = new Set();
const reachableProcs = new Set();

while (queue.length) {
  const name = queue.shift();
  if (visited.has(name)) continue;
  visited.add(name);
  const def = procByName[name] || fusionProcByName[name];
  if (!def) continue;
  const { tables, procs } = extractRefs(def);
  direct[name] = { tables: [...tables], procs: [...procs] };
  for (const t of tables) if (allTables.has(t)) reachableTables.add(t);
  for (const p of procs) if (!visited.has(p)) queue.push(p);
  reachableProcs.add(name);
}

const output = {
  backendSps: BACKEND_SPS,
  reachableProcs: [...reachableProcs].sort(),
  reachableTables: [...reachableTables].sort(),
  direct,
};
fs.writeFileSync(path.join(__dirname, '..', 'f0_out', 'scope.json'), JSON.stringify(output, null, 2));

console.log('SPs alcanzables (cierre):', reachableProcs.size);
console.log('Tablas alcanzables:', reachableTables.size);
console.log('\n--- Tablas NO alcanzadas por los SPs del backend (de las 143) ---');
const unused = [...allTables].filter((t) => !reachableTables.has(t)).sort();
console.log(unused.join('\n'));
console.log('\nTotal tablas no alcanzadas:', unused.length);

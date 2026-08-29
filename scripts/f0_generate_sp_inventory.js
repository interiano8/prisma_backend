/*
 * F0 — Genera docs/inventario_stored_procedures.md
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tpv = JSON.parse(fs.readFileSync(path.join(root, 'f0_out', 'tpv_schema.json'), 'utf8'));
const fusion = JSON.parse(fs.readFileSync(path.join(root, 'f0_out', 'fusion_schema.json'), 'utf8'));
const scope = JSON.parse(fs.readFileSync(path.join(root, 'f0_out', 'scope.json'), 'utf8'));

const BACKEND_SPS = new Set(scope.backendSps);
const direct = scope.direct || {};

// Propósito curado de los SPs que el backend invoca (36) + Fusion (10)
const purpose = {
  // Correlativos / numeración
  EINextInvoice: 'Obtiene el siguiente correlativo de factura (CAI, serie, rango, vigencia, advertencias).',
  EINextCreditNotev2: 'Siguiente correlativo de nota de crédito.',
  EINextPosTransactionIDNumber: 'Siguiente ID de transacción POS.',
  EINextCreditNote: 'Variante de correlativo de nota de crédito (invocada internamente).',
  EINextTicket: 'Siguiente correlativo de ticket (invocada internamente).',
  // Inserción de ventas
  EIInsertInvoiceFullV1: 'Inserta factura completa: encabezado + líneas + pagos + log de transacción.',
  EIInsertTicketFullV1: 'Inserta ticket completo.',
  EIInsertSalesLine: 'Inserta una línea de venta.',
  EIInsertCreditNote: 'Inserta nota de crédito.',
  InsertPaymentMethods: 'Inserta los métodos de pago de una venta.',
  // Turno
  OpenNewShift: 'Abre turno: valida duplicados, genera correlativo e inserta en POS Closed Shift.',
  CloseShiftV2: 'Cierra turno: marca Shift Ending y actualiza importe contado.',
  // Cliente / descuento / impuesto
  CreateNewCustomer: 'Crea un cliente nuevo (valida RTN duplicado).',
  sp_CalcularTotalConDescuentoYISV: 'Calcula total con descuento e ISV (15%/18%) por producto.',
  // Leal / fidelidad
  sp_InsertarPOSSalesHeaderLeal: 'Relaciona una venta con la transacción Leal (puntos).',
  // Reimpresión / detalle
  GetHeaderInvoice: 'Encabezado de factura para reimpresión.',
  GetHeaderInvoiceDetail: 'Detalle de encabezado de factura.',
  // Cierre / reportes
  GetAvailableDataForDate: 'Datos disponibles por fecha para cierre.',
  GetDetailsCombustiblesV2: 'Detalle de combustibles (cierre).',
  GetDetailsOtherProducts: 'Detalle de otros productos.',
  GetDetailsImpuestosForPOS: 'Detalle de impuestos.',
  GetDetailsPaymentsMethod: 'Detalle de métodos de pago.',
  GetDetailsTicket: 'Detalle de tickets.',
  GetGranTotalTicket: 'Gran total de tickets.',
  GetTotalCombustibles: 'Total combustibles.',
  GetTotalOtherProducts: 'Total otros productos.',
  GetTotalPaymentsMethod: 'Total por método de pago.',
  GetTotalDescuentos: 'Total descuentos.',
  'GetTotalEfectivo-MovCaja': 'Total efectivo / movimiento de caja.',
  GetTotalInvoice: 'Total facturas.',
  GetTotalSale: 'Total ventas.',
  GetTotalTicket: 'Total tickets.',
  GetEntradaDolar: 'Entrada de dólares.',
  GetSalidaLps: 'Salida en lempiras.',
  GetUniquePumpNumbersWithEmployee: 'Bombas únicas por empleado.',
  // Surtidores (FusionController)
  GetSalesByPumpNumber: '[Fusion] Ventas por bomba.',
  UpdateIsInvoiced: '[Fusion] Marca una venta como facturada.',
  ReversarTransaccion: '[Fusion] Revierte una venta de surtidor.',
};

function categorize(name) {
  if (/^EINext|^GetTotal|^GetDetails|^GetGranTotal|^GetEntrada|^GetSalida/.test(name)) return 'Correlativos y totales (cierre/reporte)';
  if (/^EIInsert|^InsertPaymentMethods/.test(name)) return 'Inserción de ventas/pagos';
  if (/^OpenNewShift|^CloseShift|^NextShift|^InsertNewShift|^GetNextShift|^GetOpenShift|^GetCanCloseShift|^UpdateStoreShift|^UpdateStoreLines/.test(name)) return 'Turnos';
  if (/^GetHeader|^GetInvoice|^GetPOSSales|^GetTransactionDetails|^GetSale|^GetReport|^GetList|^GetMaxDocument|^GetPendingTransactions/.test(name)) return 'Consulta de ventas/reimpresión';
  if (/^CreateNewCustomer|^GetCustomer|^UpdateCustomerInfo|^ChangeClient|^GetEmployeeInfoByRFID|^LoginAdmin/.test(name)) return 'Clientes/empleados/autenticación';
  if (/^sp_/.test(name)) return 'Cálculo ISV/descuento, resumen y Leal';
  if (/^usp_/.test(name)) return 'Integración Dynamics NAV (XML/import/export)';
  if (/^Extraer_/.test(name)) return 'Extracción BCPOS/Fusion';
  if (/^BulkInsert|^InsertItemFromBC|^InsertChargeMethod|^Insertar_|^InsertTaxDocuments|^UpdateTaxDocuments|^getTaxDocument|^GetTax|^InsertaImagenEmisor/.test(name)) return 'Importación de datos maestros';
  if (/^GetProduct|^GetItem|^GetSalesPrice|^Actualizar_Producto|^GetHouseFS|^GetDispenser/.test(name)) return 'Productos/precios/surtidor';
  return 'Otros';
}

let md = `# Inventario de stored procedures

Generado por \`scripts/f0_generate_sp_inventory.js\`.

- **TPV**: ${tpv.procedures.length} procedimientos · **FusionController**: ${fusion.procedures.length}.
- Los **${BACKEND_SPS.size} marcados con ★** son los que invoca el backend (se reimplementan como servicios NestJS).
- El resto son internos de Dynamics NAV/LS Retail, de integración o variantes no usadas por el backend actual.

## SPs que usa el backend (reimplementar en NestJS)

| SP | Propósito | Tablas que toca |
|---|---|---|
`;
const backendOrder = [...BACKEND_SPS].sort();
for (const name of backendOrder) {
  const d = direct[name] || { tables: [], procs: [] };
  md += `| ★ \`${name}\` | ${purpose[name] || ''} | ${d.tables.join(', ') || '—'} |\n`;
}

// Resto agrupado
md += `\n## Resto de SPs (por categoría)\n\n`;
const byCat = {};
for (const p of tpv.procedures) {
  if (BACKEND_SPS.has(p.name)) continue;
  const c = categorize(p.name);
  (byCat[c] = byCat[c] || []).push(p.name);
}
for (const [cat, names] of Object.entries(byCat)) {
  md += `### ${cat}\n\n`;
  md += names.sort().map((n) => `- \`${n}\``).join('\n');
  md += '\n\n';
}

md += `## FusionController\n\n`;
for (const p of fusion.procedures) {
  const star = BACKEND_SPS.has(p.name) ? '★ ' : '';
  md += `- ${star}\`${p.name}\`\n`;
}
md += '\n';

fs.writeFileSync(path.join(root, 'docs', 'inventario_stored_procedures.md'), md);
console.log('docs/inventario_stored_procedures.md generado');

# Inventario de stored procedures

Generado por `scripts/f0_generate_sp_inventory.js`.

- **TPV**: 160 procedimientos · **FusionController**: 10.
- Los **36 marcados con ★** son los que invoca el backend (se reimplementan como servicios NestJS).
- El resto son internos de Dynamics NAV/LS Retail, de integración o variantes no usadas por el backend actual.

## SPs que usa el backend (reimplementar en NestJS)

| SP | Propósito | Tablas que toca |
|---|---|---|
| ★ `CloseShiftV2` | Cierra turno: marca Shift Ending y actualiza importe contado. | POS Closed Shift, POS Transaction Log |
| ★ `CreateNewCustomer` | Crea un cliente nuevo (valida RTN duplicado). | Customer, Type |
| ★ `EIInsertCreditNote` | Inserta nota de crédito. | POS Sales Header, No_ Series Line, POS Transaction Log |
| ★ `EIInsertInvoiceFullV1` | Inserta factura completa: encabezado + líneas + pagos + log de transacción. | POS Sales Header, POS Sales Line, POS Sales Charge Line, No_ Series Line, POS Transaction Log |
| ★ `EIInsertSalesLine` | Inserta una línea de venta. | POS Sales Line |
| ★ `EIInsertTicketFullV1` | Inserta ticket completo. | POS Sales Header, POS Sales Line, POS Sales Charge Line, No_ Series Line, POS Transaction Log |
| ★ `EINextCreditNotev2` | Siguiente correlativo de nota de crédito. | No_ Series Line |
| ★ `EINextInvoice` | Obtiene el siguiente correlativo de factura (CAI, serie, rango, vigencia, advertencias). | No_ Series Line |
| ★ `EINextPosTransactionIDNumber` | Siguiente ID de transacción POS. | No_ Series Line |
| ★ `GetAvailableDataForDate` | Datos disponibles por fecha para cierre. | POS Transaction Log |
| ★ `GetDetailsCombustiblesV2` | Detalle de combustibles (cierre). | POS Sales Line, POS Transaction Log, (SELECT DISTINCT, HoseFS |
| ★ `GetDetailsImpuestosForPOS` | Detalle de impuestos. | POS Sales Line, POS Transaction Log |
| ★ `GetDetailsOtherProducts` | Detalle de otros productos. | POS Sales Line, POS Transaction Log, HoseFS |
| ★ `GetDetailsPaymentsMethod` | Detalle de métodos de pago. | POS Sales Charge Line, POS Transaction Log |
| ★ `GetDetailsTicket` | Detalle de tickets. | POS Sales Charge Line, POS Transaction Log |
| ★ `GetEntradaDolar` | Entrada de dólares. | POS Sales Charge Line, POS Transaction Log |
| ★ `GetGranTotalTicket` | Gran total de tickets. | POS Sales Line, POS Transaction Log |
| ★ `GetHeaderInvoice` | Encabezado de factura para reimpresión. | POSSalesHeaderLeal, POS Sales Header, POS Transaction Log, No_ Series Line |
| ★ `GetHeaderInvoiceDetail` | Detalle de encabezado de factura. | POSSalesHeaderLeal, POS Sales Header, POS Transaction Log, No_ Series Line |
| ★ `GetSalesByPumpNumber` | [Fusion] Ventas por bomba. | Store, FusionSales |
| ★ `GetSalidaLps` | Salida en lempiras. | POS Sales Header, POS Transaction Log |
| ★ `GetTotalCombustibles` | Total combustibles. | POS Sales Line, POS Transaction Log, HoseFS |
| ★ `GetTotalDescuentos` | Total descuentos. | POS Sales Line, POS Transaction Log |
| ★ `GetTotalEfectivo-MovCaja` | Total efectivo / movimiento de caja. | POS Cash Entries, POS Transaction Log, POS Sales Charge Line |
| ★ `GetTotalInvoice` | Total facturas. | POS Transaction Log |
| ★ `GetTotalOtherProducts` | Total otros productos. | POS Sales Line, POS Transaction Log, HoseFS |
| ★ `GetTotalPaymentsMethod` | Total por método de pago. | POS Sales Charge Line, POS Transaction Log |
| ★ `GetTotalSale` | Total ventas. | POS Sales Line, POS Transaction Log |
| ★ `GetTotalTicket` | Total tickets. | POS Transaction Log |
| ★ `GetUniquePumpNumbersWithEmployee` | Bombas únicas por empleado. | POS Transaction Log, POS Sales Line |
| ★ `InsertPaymentMethods` | Inserta los métodos de pago de una venta. | POS Sales Charge Line |
| ★ `OpenNewShift` | Abre turno: valida duplicados, genera correlativo e inserta en POS Closed Shift. | POS Closed Shift, No_ Series Line |
| ★ `ReversarTransaccion` | [Fusion] Revierte una venta de surtidor. | FusionSales |
| ★ `UpdateIsInvoiced` | [Fusion] Marca una venta como facturada. | FusionSales |
| ★ `sp_CalcularTotalConDescuentoYISV` | Calcula total con descuento e ISV (15%/18%) por producto. | Descuentos |
| ★ `sp_InsertarPOSSalesHeaderLeal` | Relaciona una venta con la transacción Leal (puntos). | POSSalesHeaderLeal |

## Resto de SPs (por categoría)

### Productos/precios/surtidor

- `Actualizar_Producto`
- `GetDispenser`
- `GetDispenserDetails`
- `GetHouseFS`
- `GetItemShortcut`
- `GetProducts`

### Importación de datos maestros

- `BulkInsertCustomers`
- `BulkInsertItemReferences`
- `BulkInsertItems`
- `BulkInsertSalesPrices`
- `InsertChargeMethod`
- `InsertItemFromBC`
- `InsertTaxDocuments`
- `InsertaImagenEmisor`
- `Insertar_SalesPrice_Item`
- `UpdateTaxDocuments`
- `getTaxDocument`

### Clientes/empleados/autenticación

- `ChangeClient`
- `GetCustomer`
- `GetEmployeeInfoByRFID`
- `LoginAdmin`
- `UpdateCustomerInfo`

### Turnos

- `CloseShiftAndCreateNew`
- `CloseShiftInsertNew`
- `GetCanCloseShift`
- `GetNextShift`
- `GetNextShiftDetails`
- `GetOpenShift`
- `InsertNewShift`
- `NextShift`
- `UpdateStoreLines`
- `UpdateStoreShift`

### Otros

- `CreateTemporalTableSaleLine`
- `GetBomberoInfo`
- `GetButtonTab`
- `GetDetailbyfuels`
- `GetDocumentInvoiceforAdministrator`
- `GetHeadTab`
- `GetStoreShiftConfiguration`
- `SP_GetCurrentDateTime`
- `SP_GetItemNoByReferenceNo`
- `SP_ObtenerTasaCambioHoy`
- `SaleByChangeMethodeByPump`
- `updateStatusTransactionLog`

### Inserción de ventas/pagos

- `EIInsertCashEntries`
- `EIInsertInvoice`
- `EIInsertInvoiceV2`
- `EIInsertTicket`
- `EIInsertTicketV2`

### Correlativos y totales (cierre/reporte)

- `EINextCreditNote`
- `EINextInvoiceRangoUnico`
- `EINextInvoicev2`
- `EINextTicket`
- `GetDetailsCashEntries`
- `GetDetailsCombustibles`
- `GetDetailsCombustiblesForAdminV2`
- `GetDetailsCombustiblesforAdministrator`
- `GetDetailsDesgloseforAdministrator`
- `GetDetailsImpuestos`
- `GetDetailsMaxAndMinInvoiceforAdministrator`
- `GetDetailsOtherProductsforAdministrator`
- `GetDetailsPaymentsMethodforAdministrator`
- `GetTotalTaxDocuments`
- `GetTotalizerforAdministrador`

### Extracción BCPOS/Fusion

- `Extraer_BCPOS_Clientes`
- `Extraer_BCPOS_Documentos`
- `Extraer_BCPOS_Entregas`
- `Extraer_BCPOS_Facturacion`
- `Extraer_BCPOS_Operaciones`
- `Extraer_BCPOS_Precios`
- `Extraer_Fusion_Entregas`
- `Extraer_Fusion_Operaciones`

### Consulta de ventas/reimpresión

- `GetHeaderInvoiceNotCreditNote`
- `GetInvoiceLines`
- `GetInvoicePaymentMethod`
- `GetListDetailsForDate`
- `GetListEmployeeNameForDate`
- `GetMaxDocument`
- `GetPOSSalesChargeLine`
- `GetPOSSalesChargeLineForBC`
- `GetPOSSalesHeader`
- `GetPOSSalesHeaderForBC`
- `GetPOSSalesLine`
- `GetPOSSalesLineForBC`
- `GetPendingTransactions`
- `GetReportSaleDetails`
- `GetReportSaleSummary`
- `GetReporteSaleResumido`
- `GetSaleForAccountStatement`
- `GetSalebyFuelAttendantbyChargeMethod`
- `GetSalebyFuelAttendantbyChargeMethodbyProduct`
- `GetSalebyFuelAttendantbyTotal`
- `GetSalesByFuelAllFuelAttendantPOSSalesChargeLine`
- `GetSalesPrice`
- `GetSalesPriceOfItem`
- `GetTransactionDetails`

### Cálculo ISV/descuento, resumen y Leal

- `sp_GetSalesGrandTotalCL`
- `sp_GetSalesOtrosProductos`
- `sp_GetSalesOtrosProductosv2`
- `sp_GetSalesSummary`
- `sp_GetSalesSummaryCL`
- `sp_GetSalesSummaryCL_NoPivot`
- `sp_GetTotalSalesCombustibles`
- `sp_GetTotalSalesOtrosProductos`
- `sp_GetTotalSalesQuiry`

### Integración Dynamics NAV (XML/import/export)

- `usp_Crea_Transaccion_XML`
- `usp_Crea_Transacciones_XML`
- `usp_DocumentToDisk`
- `usp_DocumentToXML`
- `usp_FacturaTPV_Cab`
- `usp_FacturaTPV_IVA`
- `usp_FacturaTPV_Lin`
- `usp_FinTurno`
- `usp_GeneraSeries`
- `usp_GeneraSeries_Select_A`
- `usp_GeneraSeries_Select_M`
- `usp_LimpiaTablasImportNAV`
- `usp_LimpiaTablasTransacciones`
- `usp_Lista_Transacciones_XML`
- `usp_PROM_Info_Definicion_Promocion`
- `usp_ProximoCambioPrecio`
- `usp_SelectCountTablasImportNAV`
- `usp_SelectTablasImportNAV`
- `usp_SelectTablasTransacciones`
- `usp_SelectTransacPendientesSubir`
- `usp_Transaccion_Ventas`
- `usp_XMLVariableToFile`

## FusionController

- `GetIsInvoicedStatus`
- `GetMaxSaleID`
- ★ `GetSalesByPumpNumber`
- `GetSalesByPumpNumber01`
- `GetSalesByPumpNumberAndHoseNumber`
- `InsertFusionSale`
- ★ `ReversarTransaccion`
- `SP_FusionSales_Consolidado`
- `sp_InsertFusionSaleVOX`
- ★ `UpdateIsInvoiced`


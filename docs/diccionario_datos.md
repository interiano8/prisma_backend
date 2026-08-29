# Diccionario de datos — migración TPV → PostgreSQL

Generado automáticamente por `scripts/f0_generate_docs.js` desde el esquema real de SQL Server.

## Resumen

| | TPV | FusionController |
|---|---|---|
| Tablas (base) | 132 | 4 |
| Columnas | 1237 | 48 |
| Stored procedures | 160 | 10 |
| Vistas | 11 | — |

- **Convención**: `snake_case` en español, tablas en plural.
- **Tamaño TPV**: 2772.50 MB
- Clasificación de tablas: **núcleo** (migrar), **fiscal**, **catálogo**, **surtidores**, **sorteos**, **log** (opcional), **temporal/legacy** (NO migrar).

## Hallazgos

1. `POS_Sorteo`, `StoreConfig` y `MobileDispenser` **NO existen** en la base actual, pero el backend las referencia (`invoice-repository`, `sorteos-repository`, modelo Prisma `Dispenser`). Son referencias muertas que fallan en silencio. En Postgres se crearán como tablas nuevas (`ventas_sorteo`, `configuracion_tienda`) o se eliminará el código.
2. Los modelos de `schema.prisma` (`Shift`, `Invoice`, `InvoiceItem`, `Dispenser`) están muertos; toda la persistencia real es SQL crudo.
3. Hay ~15 tablas `Temp_*` usadas como scratch por los SPs de reportes (cierre de turno). Se eliminan al reimplementar en NestJS.
4. `FusionController` es una base aparte (controlador de surtidores) con 4 tablas.

---

## Tablas núcleo (migrar)

### `Employee` → **empleados** _(~29 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Id` | `id` | integer | no |
| `Nombre` | `nombre` | varchar(100) | sí |
| `PIN` | `pin` | varchar(450) | sí |
| `Usuario` | `usuario` | varchar(100) | no |
| `Perfil` | `perfil` | varchar(20) | sí |
| `Is_active` | `esta_activo` | boolean | sí |
| `Codigo_RFID` | `codigo_rfid` | varchar(450) | sí |
| `PasswordHash` | `hash_contrasena` | varchar(450) | sí |

### `Store` → **tiendas** _(~1 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `StoreID` | `id_tienda` | varchar(10) | no |
| `Titulo` | `titulo` | text | sí |
| `Name` | `nombre` | text | sí |
| `RTN` | `rtn` | varchar(50) | no |
| `Country` | `pais` | varchar(50) | no |
| `State` | `estado` | varchar(50) | no |
| `City` | `ciudad` | varchar(50) | sí |
| `Address1` | `direccion_1` | text | sí |
| `Address2` | `direccion_2` | text | sí |
| `Address3` | `direccion_3` | text | sí |
| `Phone` | `telefono` | varchar(50) | no |
| `Email` | `correo` | varchar(50) | no |
| `PassAdmin` | `contrasena_admin` | text | no |
| `Turnos` | `turnos` | integer | no |
| `D3` | `d3` | integer | sí |
| `D4` | `d4` | integer | sí |
| `NumberOfTransactionsWaiting` | `transacciones_pendientes` | integer | sí |
| `URLLEAL` | `url_leal` | text | sí |
| `isLealEnabled` | `leal_habilitado` | boolean | sí |
| `CodeCountry` | `codigo_pais` | varchar(50) | sí |
| `IsGasController` | `es_controlador_gas` | boolean | sí |
| `WarningNewInvoiceRanges` | `aviso_nuevos_rangos_factura` | integer | sí |
| `WarningNewCreditNotesRanges` | `aviso_nuevos_rangos_nota_credito` | integer | sí |
| `IsFusionAssigned` | `fusion_asignado` | boolean | sí |
| `IPFusionController` | `ip_fusion` | text | sí |
| `Api` | `api` | text | sí |
| `MultipleItemsAllowed` | `varias_lineas_permitidas` | boolean | sí |
| `AllowedToApplyDiscounts` | `descuentos_permitidos` | boolean | sí |
| `BlockedForPendingTransactions` | `bloqueado_transacciones_pendientes` | boolean | sí |
| `DebugMode` | `modo_depuracion` | boolean | sí |
| `FusionControllerKey` | `clave_fusion` | text | sí |
| `NoConsumidorFinal` | `codigo_consumidor_final` | text | sí |
| `URLSaldo` | `url_saldo` | text | sí |
| `ValidarRFID` | `validar_rfid` | boolean | sí |
| `ValidarSaldoCredito` | `validar_saldo_credito` | boolean | sí |
| `VoxIsActive` | `vox_activo` | boolean | sí |
| `RangoIndividual` | `rango_individual` | boolean | sí |
| `FacturacionOrdenada` | `facturacion_ordenada` | boolean | sí |
| `ERP` | `erp` | varchar(50) | sí |
| `Url_Actualizacion` | `url_actualizacion` | text | sí |
| `URLBaseERP` | `url_base_erp` | text | sí |
| `Turno_Manual` | `turno_manual` | boolean | sí |
| `Calculo_Inverso` | `calculo_inverso` | boolean | sí |
| `BlockedForPendingPumpTransactions` | `bloqueado_transacciones_bomba` | boolean | no |
| `BlockedForPendingShiftTransactions` | `bloqueado_transacciones_turno` | boolean | no |
| `Sorteos` | `sorteos` | boolean | sí |
| `DeclararMontoInicial` | `declarar_monto_inicial` | boolean | sí |

### `POS Closed Shift` → **turnos** _(~1050 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Shift` | `turno` | varchar(10) | sí |
| `idWeekDay` | `id_dia_semana` | integer | sí |
| `Shift Starting` | `inicio_turno` | timestamptz | no |
| `Shift Ending` | `fin_turno` | timestamptz | sí |
| `ImporteContado` | `importe_contado` | numeric(18,6) | no |
| `EmployeeName` | `nombre_empleado` | varchar(20) | sí |
| `MontoInicial` | `monto_inicial` | numeric(18,2) | sí |

### `TPV_config` → **configuracion_pos** _(~4 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Code` | `codigo_pos` | varchar(10) | sí |
| `ScreenOnPump` | `pantalla_en_bomba` | boolean | no |
| `ApplyBlockOnlyPOS` | `bloquear_solo_pos` | boolean | sí |
| `ShowAdvertisingVideo` | `mostrar_video_publicidad` | boolean | sí |
| `ReimprimirVarios` | `reimprimir_varios` | boolean | sí |
| `FacturarVariasLineas` | `facturar_varias_lineas` | boolean | sí |
| `DescuentoManual` | `descuento_manual` | boolean | sí |
| `OcultarBotonOtrasDispensadoras` | `ocultar_boton_otras_bombas` | boolean | sí |
| `OcultarInformacionTurnos` | `ocultar_informacion_turnos` | boolean | sí |

### `Customer` → **clientes** _(~1066 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `No_` | `codigo` | varchar(20) | no |
| `Name` | `nombre` | varchar(150) | sí |
| `Address` | `direccion` | varchar(100) | sí |
| `City` | `ciudad` | varchar(30) | sí |
| `Phone No_` | `telefono` | varchar(30) | sí |
| `Customer Disc_ Group` | `grupo_descuento` | varchar(20) | sí |
| `Country_Region Code` | `codigo_pais` | varchar(10) | sí |
| `Blocked` | `bloqueado` | boolean | sí |
| `VAT Registration No_` | `rtn` | varchar(30) | no |
| `Post Code` | `codigo_postal` | varchar(20) | sí |
| `County` | `municipio` | varchar(30) | sí |
| `E-Mail` | `correo` | varchar(80) | sí |
| `Usual Billing Type` | `tipo_facturacion` | integer | no |
| `Status` | `estado` | varchar(30) | sí |
| `Customer PROM Group` | `grupo_promo` | varchar(20) | sí |
| `Update Type` | `tipo_actualizacion` | integer | sí |
| `DateUpdate` | `fecha_actualizacion` | timestamptz | sí |
| `bcid` | `bcid` | text | sí |
| `DateofBirth` | `fecha_nacimiento` | date | sí |
| `IdDepartamento` | `id_departamento` | integer | sí |
| `IdMunicipio` | `id_municipio` | integer | sí |
| `Balance_LCY` | `saldo_moneda_local` | numeric(18,2) | sí |
| `Balance` | `saldo` | numeric(18,2) | sí |
| `Customer Posting_ Group` | `grupo_contable` | varchar(20) | sí |
| `Gen_ Bus_ Posting_ Group` | `grupo_contable_negocio` | varchar(20) | sí |

### `Item` → **productos** _(~30 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `No_` | `codigo` | varchar(20) | no |
| `Description` | `descripcion` | varchar(100) | sí |
| `Unit Price` | `precio_unitario` | numeric(18,6) | sí |
| `Blocked` | `bloqueado` | boolean | no |
| `Picture` | `imagen` | bytea | sí |
| `VAT Prod_ Posting Group` | `grupo_isv` | varchar(20) | no |
| `Item Category Code` | `codigo_categoria` | varchar(20) | sí |
| `Product Group Code` | `codigo_grupo` | text | sí |
| `Bonified` | `bonificado` | boolean | sí |
| `UoM Conversion Factor` | `factor_conversion_um` | numeric(18,6) | sí |
| `Labels UoM Code` | `codigo_um_etiquetas` | varchar(10) | sí |
| `Gen_ Pump Ledg_ Entry` | `genera_asiento_bomba` | boolean | sí |
| `Item Disc_ Group` | `grupo_descuento` | varchar(20) | sí |
| `POS Price Change Allowed` | `permite_cambio_precio` | boolean | sí |
| `PROM Item Category Code` | `codigo_categoria_promo` | varchar(20) | sí |
| `POS Negative Quantity Allowed` | `permite_cantidad_negativa` | boolean | sí |
| `BC_ID` | `bc_id` | varchar(40) | sí |
| `vendorId` | `id_proveedor` | integer | sí |
| `IsAgeDiscountApplied` | `aplica_descuento_edad` | boolean | sí |

### `Sales Price` → **precios_producto** _(~24 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Item No_` | `codigo_producto` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `Starting Date` | `fecha_inicio` | timestamptz | no |
| `Starting Time` | `hora_inicio` | timestamptz | no |
| `Minimum Quantity` | `cantidad_minima` | numeric(18,6) | no |
| `Unit Price` | `precio_unitario` | numeric(18,6) | no |
| `Ending Date` | `fecha_fin` | timestamptz | no |
| `Ending Time` | `hora_fin` | timestamptz | no |
| `Status` | `estado` | smallint | no |
| `Id` | `id` | integer | no |

### `Descuentos` → **descuentos** _(~132 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `codigo_cliente` | `codigo_cliente` | varchar(20) | no |
| `codigo_item` | `codigo_producto` | varchar(20) | no |
| `porcentaje` | `porcentaje` | numeric(18,6) | no |
| `CustomerRTN` | `rtn_cliente` | text | sí |
| `StoreID` | `id_tienda` | varchar(20) | sí |
| `StartingDate` | `fecha_inicio` | date | sí |
| `EndingDate` | `fecha_fin` | date | sí |
| `AmountPerGallon` | `monto_por_galon` | numeric(18,6) | sí |
| `AmountPerLiter` | `monto_por_litro` | numeric(18,6) | sí |
| `ReferenceUnitPrice` | `precio_referencia` | text | sí |
| `EntryMode` | `modo_ingreso` | text | sí |
| `Active` | `activo` | boolean | sí |

### `Charge Method` → **metodos_pago** _(~14 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Code` | `codigo` | varchar(10) | no |
| `Description` | `descripcion` | varchar(100) | no |
| `Excl_ in Shift Summary` | `excluir_resumen_turno` | boolean | no |
| `Used By` | `usado_por` | integer | no |
| `Charge Type` | `tipo_cargo` | integer | no |
| `Expired in POS` | `vencido_en_pos` | boolean | no |
| `Invoice` | `factura` | boolean | no |
| `Ticket` | `ticket` | boolean | no |
| `Credit` | `credito` | boolean | no |
| `Referencia` | `referencia` | boolean | sí |

### `LEAL` → **configuracion_leal** _(~1 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `user` | `usuario` | varchar(100) | sí |
| `pass` | `contrasena` | varchar(100) | sí |

### `HoseFS` → **mangueras** _(~40 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `ID` | `id` | integer | no |
| `HoseID` | `id_manguera` | integer | no |
| `GradeNumber` | `numero_grado` | integer | sí |
| `GradeName` | `nombre_grado` | varchar(100) | sí |
| `PricePerUnit` | `precio_unitario` | numeric(10,2) | sí |
| `TankIDs` | `ids_tanques` | text | sí |
| `PumpID` | `id_bomba` | integer | no |
| `HosePhysicalID` | `id_manguera_fisica` | integer | sí |
| `POS` | `pos` | varchar(10) | sí |
| `CodigoPOS` | `codigo_pos` | varchar(100) | sí |
| `CodigoGenerico` | `codigo_generico` | varchar(100) | sí |
| `EsVisible` | `visible` | boolean | sí |

### `No_ Series` → **series** _(~5 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Code` | `codigo` | varchar(10) | no |
| `Description` | `descripcion` | varchar(50) | no |
| `Iniciales` | `iniciales` | varchar(2) | no |

### `No_ Series Line` → **series_documento** _(~19 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Series Code` | `codigo_serie` | varchar(10) | no |
| `Line No_` | `numero_linea` | integer | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Starting Date` | `fecha_inicio` | timestamptz | no |
| `Starting No_` | `numero_inicio` | varchar(20) | no |
| `Ending No_` | `numero_fin` | varchar(20) | no |
| `Warning No_` | `numero_aviso` | varchar(20) | no |
| `Increment-by No_` | `incremento` | integer | no |
| `Last No_ Used` | `ultimo_numero_usado` | varchar(20) | no |
| `Open` | `abierta` | boolean | no |
| `Last Date Used` | `ultima_fecha_usada` | timestamptz | no |
| `CAI` | `cai` | varchar(50) | no |
| `Rango Desde` | `rango_desde` | varchar(20) | no |
| `Rango Hasta` | `rango_hasta` | varchar(20) | no |
| `Fecha Vence Rango` | `fecha_vence_rango` | date | no |

### `POS Sales Header` → **ventas** _(~78865 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Inv_ Broadcaster No_` | `numero_emisor` | varchar(20) | no |
| `POS Sales Doc_ Type` | `tipo_documento` | integer | no |
| `POS Sales Doc_ No_` | `numero_documento` | varchar(20) | no |
| `Customer No_` | `codigo_cliente` | varchar(20) | no |
| `Sale Date Time` | `fecha_hora_venta` | timestamptz | no |
| `Amount` | `monto` | numeric(18,6) | no |
| `Cust_ Card No_` | `numero_tarjeta_cliente` | varchar(20) | no |
| `Points Card No_` | `numero_tarjeta_puntos` | varchar(20) | no |
| `Plate No_` | `placa` | varchar(20) | no |
| `Rel_ Sales Document No_` | `documento_relacionado` | varchar(20) | no |
| `Salesperson Code` | `codigo_vendedor` | varchar(20) | no |
| `VAT Reg_ No_` | `rtn_cliente` | varchar(20) | no |
| `Cust_ Name` | `nombre_cliente` | varchar(150) | no |
| `Cust_ Name 2` | `nombre_cliente_2` | varchar(50) | no |
| `Cust_ Address` | `direccion_cliente` | varchar(100) | no |
| `Cust_ Address 2` | `direccion_cliente_2` | varchar(50) | no |
| `Cust_ Post Code` | `codigo_postal_cliente` | varchar(10) | no |
| `Cust_ City` | `ciudad_cliente` | varchar(30) | no |
| `Cust_ County` | `municipio_cliente` | varchar(30) | no |
| `Cust_ Country_Reg_ Code` | `codigo_pais_cliente` | varchar(20) | no |
| `Billing Type` | `tipo_facturacion` | integer | no |
| `Cust_ E-Mail` | `correo_cliente` | varchar(80) | no |
| `Comment` | `comentario` | varchar(400) | sí |
| `BC_ID` | `bc_id` | varchar(50) | sí |
| `Line No_` | `numero_linea` | integer | sí |
| `SubTotal` | `subtotal` | numeric(18,6) | sí |
| `KM` | `kilometraje` | varchar(50) | sí |
| `Orden` | `orden` | varchar(50) | sí |
| `Placa` | `placa` | varchar(50) | sí |
| `Chofer` | `chofer` | varchar(50) | sí |
| `Cambio` | `cambio` | numeric(18,0) | sí |

### `POS Sales Line` → **lineas_venta** _(~107145 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Inv_ Broadcaster No_` | `numero_emisor` | varchar(20) | no |
| `POS Sales Doc_ Type` | `tipo_documento` | integer | no |
| `POS Sales Doc_ No_` | `numero_documento` | varchar(20) | no |
| `POS Sales Doc_ Line No_` | `numero_linea_documento` | integer | no |
| `POS Sales Type` | `tipo_venta` | integer | no |
| `POS Sales No_` | `numero_venta` | varchar(20) | no |
| `Description` | `descripcion` | varchar(50) | no |
| `Quantity` | `cantidad` | numeric(18,6) | no |
| `Unit Price Incl_ VAT` | `precio_unitario_con_isv` | numeric(18,6) | no |
| `Unit Discount Amount` | `monto_descuento_unitario` | numeric(18,6) | no |
| `Discount _` | `descuento` | numeric(18,6) | no |
| `Line Discount Amount` | `monto_descuento_linea` | numeric(18,6) | no |
| `VAT _` | `isv` | numeric(18,6) | no |
| `VAT_Amount` | `monto_isv` | numeric(18,6) | sí |
| `Amount Including VAT` | `monto_con_isv` | numeric(18,6) | no |
| `Pump No_` | `numero_bomba` | varchar(10) | no |
| `Pump Position No_` | `posicion_bomba` | varchar(10) | no |
| `Tank No_` | `numero_tanque` | varchar(10) | no |
| `Operation Time` | `hora_operacion` | timestamptz | no |
| `Item Category Code` | `codigo_categoria` | varchar(20) | no |
| `Bonified` | `bonificado` | boolean | no |
| `Returned` | `devuelto` | boolean | no |
| `Gen_ Pump Ledg_ Entry` | `genera_asiento_bomba` | boolean | no |
| `VAT Prod_ Posting Group` | `grupo_isv` | varchar(10) | no |
| `Source POS Transaction ID` | `id_transaccion_origen` | varchar(20) | no |
| `Source POS Sales Doc_ No_` | `documento_origen` | varchar(20) | no |
| `Source POS Sales Doc_ Line No_` | `linea_documento_origen` | integer | no |
| `DOMS Trans No_` | `numero_transaccion_doms` | varchar(20) | no |
| `Prepayment` | `prepago` | boolean | no |
| `Return` | `devolucion` | boolean | no |
| `Applies-to Line No_` | `numero_linea_aplicada` | integer | no |
| `Fidelity Points` | `puntos_fidelidad` | numeric(18,2) | no |
| `idFuelAttendant` | `id_despachador` | integer | sí |
| `SaleID` | `id_venta` | varchar(50) | sí |
| `TaxedAmount` | `monto_gravado` | numeric(18,6) | sí |

### `POS Sales Charge Line` → **pagos_venta** _(~79212 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Charge Line No_` | `numero_linea_pago` | integer | no |
| `Charge Method Code` | `codigo_metodo_pago` | varchar(10) | no |
| `Amount` | `monto` | numeric(18,6) | no |
| `Payment Card No_` | `numero_tarjeta` | varchar(20) | no |
| `Description` | `descripcion` | varchar(50) | no |
| `Datos Adicionales` | `datos_adicionales` | text | no |
| `idFuelAttendant` | `id_despachador` | integer | sí |
| `TasaCambio` | `tasa_cambio` | numeric(18,2) | sí |
| `MontoIngresado` | `monto_ingresado` | numeric(18,2) | sí |
| `EsTicket` | `es_ticket` | boolean | sí |

### `POSSalesHeaderLeal` → **ventas_leal** _(~0 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Id_TransaccionLeal` | `id_transaccion_leal` | varchar(20) | no |
| `Puntos` | `puntos` | integer | no |
| `PuntosActivos` | `puntos_activos` | integer | no |
| `Tipo` | `tipo` | smallint | no |
| `DNI` | `dni` | varchar(50) | sí |
| `Nombre` | `nombre` | varchar(100) | sí |
| `IDAleatorio` | `id_aleatorio` | bigint | sí |

### `POS Transaction Log` → **registro_transacciones** _(~79913 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Shift Date` | `fecha_turno` | timestamptz | no |
| `Shift No_` | `numero_turno` | varchar(2) | no |
| `Transaction Type` | `tipo_transaccion` | integer | no |
| `Transaction DateTime` | `fecha_hora_transaccion` | timestamptz | no |
| `Status` | `estado` | smallint | no |
| `EmployeeName` | `nombre_empleado` | varchar(20) | sí |

### `POS Cash Entries` → **arqueos_caja** _(~0 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `POS Transaction ID` | `id_transaccion_pos` | varchar(20) | no |
| `Gas Station Code` | `id_tienda` | varchar(10) | no |
| `POS Code` | `codigo_pos` | varchar(10) | no |
| `Charge Method Code` | `codigo_metodo_pago` | varchar(20) | no |
| `Charge Method Description` | `descripcion_metodo_pago` | varchar(50) | no |
| `Amount` | `monto` | numeric(18,6) | no |
| `Salesperson Code` | `codigo_vendedor` | varchar(20) | no |
| `POSDocNo` | `numero_documento` | varchar(20) | sí |
| `CustomerNo` | `codigo_cliente` | varchar(20) | sí |
| `Comment` | `comentario` | text | sí |

### `VAT Setup` → **configuracion_isv** _(~4 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `VAT Prod_ Posting Group` | `grupo_isv` | varchar(50) | no |
| `Starting Date` | `fecha_inicio` | timestamptz | no |
| `VAT _` | `isv` | numeric(18,6) | no |
| `Description` | `descripcion` | varchar(50) | no |

### `Motivos` → **motivos** _(~5 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Id_motivo` | `id` | integer | no |
| `motivo` | `motivo` | text | no |

### `TasaCambio` → **tasas_cambio** _(~9 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `ID_Tasa_Cambio` | `id` | integer | no |
| `Tasa_Cambio` | `tasa` | numeric(18,2) | no |
| `Fecha` | `fecha` | date | no |

### `StoreShift` → **turnos_tienda** _(~5 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Shift` | `turno` | integer | no |
| `StartTime` | `hora_inicio` | time | no |
| `EndTime` | `hora_fin` | time | no |

### `StoreShiftConfiguration` → **configuracion_turnos** _(~140 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `idWeekDay` | `id` | integer | no |
| `idStore` | `id_tienda` | varchar(50) | no |
| `posCode` | `codigo_pos` | varchar(50) | no |
| `weekDay` | `dia_semana` | varchar(50) | no |
| `shiftName` | `nombre_turno` | varchar(50) | no |
| `startTime` | `hora_inicio` | time | no |
| `endTime` | `hora_fin` | time | no |
| `isActive` | `activo` | boolean | no |
| `level` | `nivel` | integer | no |

### `Item Category` → **categorias_producto** _(~1 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Code` | `codigo` | varchar(20) | no |
| `Description` | `descripcion` | varchar(100) | no |
| `Item Category Type` | `tipo_categoria` | integer | no |
| `Update Type` | `tipo_actualizacion` | integer | sí |
| `DateUpdate` | `fecha_actualizacion` | timestamptz | sí |

### `FuelAttendant` → **despachadores** _(~10 filas)_

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `GasStationCode` | `id_tienda` | varchar(10) | no |
| `POSCode` | `codigo_pos` | varchar(10) | no |
| `idFuelAttendant` | `id` | integer | no |
| `Nombres` | `nombres` | varchar(50) | no |
| `Apellidos` | `apellidos` | varchar(50) | no |
| `DNI` | `dni` | varchar(20) | no |

## FusionController (surtidores)

### `FuelSession` → **sesiones_surtidor**

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Id` | `id` | integer | no |
| `PumpId` | `id_bomba` | integer | no |
| `RaspberryId` | `id_raspberry` | varchar(100) | no |
| `State` | `estado` | varchar(50) | no |
| `StartEmployeeId` | `id_empleado_inicio` | integer | no |
| `StartEmployeeName` | `nombre_empleado_inicio` | varchar(200) | no |
| `StartTagTime` | `hora_inicio` | timestamptz | no |
| `EndEmployeeId` | `id_empleado_fin` | integer | sí |
| `EndEmployeeName` | `nombre_empleado_fin` | varchar(200) | sí |
| `EndTagTime` | `hora_fin` | timestamptz | sí |
| `Hose` | `manguera` | varchar(50) | sí |
| `SaleId` | `id_venta` | varchar(100) | sí |
| `WasFuelling` | `fue_despacho` | boolean | no |

### `FusionSales` → **ventas_combustible**

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `SaleID` | `id_venta` | integer | no |
| `PosNumber` | `numero_pos` | integer | no |
| `PumpNumber` | `numero_bomba` | integer | no |
| `HoseNumber` | `numero_manguera` | varchar(2) | no |
| `Amount` | `monto` | numeric(18,2) | no |
| `PPU` | `precio_unitario` | numeric(18,5) | no |
| `Volume` | `volumen` | numeric(18,5) | no |
| `FinalVolumeTotal` | `volumen_final` | numeric(18,5) | no |
| `InitialVolumeTotal` | `volumen_inicial` | numeric(18,5) | no |
| `PaymentType` | `tipo_pago` | varchar(50) | sí |
| `PaymentInfo` | `info_pago` | varchar(50) | sí |
| `CompensatedTemperature` | `temperatura_compensada` | varchar(50) | sí |
| `ShiftID` | `id_turno` | varchar(50) | sí |
| `GradeNr` | `numero_grado` | integer | sí |
| `PriceLevel` | `nivel_precio` | integer | sí |
| `TypeOfTransaction` | `tipo_transaccion` | varchar(50) | sí |
| `DateOfTransaction` | `fecha_transaccion` | varchar(50) | sí |
| `TimeOfTransaction` | `hora_transaccion` | varchar(50) | sí |
| `PresetAmount` | `monto_preestablecido` | numeric(18,2) | sí |
| `PaymentAlarm` | `alarma_pago` | varchar(50) | sí |
| `ATCVO` | `atcvo` | varchar(50) | sí |
| `AVGTM` | `avgtm` | varchar(50) | sí |
| `ATCIVO` | `atcivo` | varchar(50) | sí |
| `ATCFVO` | `atcfvo` | varchar(50) | sí |
| `IsInvoiced` | `facturada` | boolean | no |
| `Date` | `fecha` | timestamptz | sí |

### `FusionSalesRetry` → **reintentos_venta_combustible**

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `vox_sale_id` | `id_venta_vox` | integer | no |
| `payload` | `payload` | text | sí |
| `retry_count` | `intentos` | integer | no |
| `last_attempt` | `ultimo_intento` | timestamptz | no |
| `error_message` | `mensaje_error` | text | sí |

### `ReaderPumpMapping` → **mapeo_lector_bomba**

| Columna original | Nueva | Tipo Postgres | Null |
|---|---|---|---|
| `Id` | `id` | integer | no |
| `ReaderPath` | `ruta_lector` | varchar(500) | no |
| `PumpId` | `id_bomba` | integer | no |
| `RaspberryId` | `id_raspberry` | varchar(100) | no |

## Tablas por categoría (resto)

### Fiscal (migrar)

| Tabla original | Nueva | Filas |
|---|---|---|
| `VAT Setup` | `configuracion_isv` | 4 |
| `No_ Series` | `series` | 5 |
| `No_ Series Line` | `series_documento` | 19 |
| `Inv_ Broadcaster` | `emisores_factura` | 1 |
| `Item Ch_ Methods Restrictions` | `restricciones_metodo_producto` | 0 |

### Catálogo/referencia (migrar)

| Tabla original | Nueva | Filas |
|---|---|---|
| `Ciudades` | `ciudades` | 253 |
| `Departamentos` | `departamentos` | 18 |
| `Codigos postales de Honduras` | `codigos_postales` | 304 |
| `Post Code` | `codigos_postales` | 304 |
| `Idioma` | `idiomas` | 439 |
| `Vendor` | `proveedores` | 157 |
| `Card Type` | `tipos_tarjeta` | 4 |
| `Card Restr_ Group Item` | `restricciones_tarjeta` | 11 |
| `Cust_ Card` | `tarjetas_cliente` | 0 |

### Surtidores/controlador (migrar si se usan)

| Tabla original | Nueva | Filas |
|---|---|---|
| `HoseController` | `mangueras_controlador` | 13 |
| `GradesController` | `grados_controlador` | 4 |
| `GradesFS` | `grados_fs` | 4 |
| `Pump` | `bombas` | 32 |
| `PumpFS` | `bombas_fs` | 8 |
| `PumpsController` | `bombas_controlador` | 4 |
| `PumpsFuelAttendant` | `despachadores_bomba` | 8 |
| `TanksController` | `tanques_controlador` | 4 |
| `TankFS` | `tanques_fs` | 3 |
| `Fuelling Point` | `puntos_despacho` | 12 |
| `Contadores_Controlador` | `contadores_controlador` | 9283 |
| `Turno_Controlador` | `turnos_controlador` | 278 |
| `Dispenser` | `dispensadores` | 20 |
| `DispenserDetail` | `dispensadores_detalle` | 8 |

### Sorteos (migrar)

| Tabla original | Nueva | Filas |
|---|---|---|
| `Sorteos` | `sorteos` | 0 |
| `SorteosCondiciones` | `condiciones_sorteo` | 0 |
| `Sorteo_Premio` | `premios_sorteo` | 18 |
| `Sorteo_Usuario` | `usuarios_sorteo` | 2 |

### Logs (opcional)

| Tabla original | Nueva | Filas |
|---|---|---|
| `LOG` | `log` | 347994 |
| `Log_SubidaDatosTPV` | `log_subida_datos` | 91532 |
| `Tpv_Logs` | `log_tpv` | 0 |
| `Tpv_Log_Suceso` | `log_suceso` | 0 |
| `ModificationsRecords` | `registros_modificaciones` | 14 |
| `COMENTARIOS` | `comentarios` | 0 |

### Temporales/scratch (NO migrar)

| Tabla original | Nueva | Filas |
|---|---|---|
| `Temp_Customer` | — | 93 |
| `Temp_Item` | — | 30 |
| `Temp_SalesPrice` | — | 24 |
| `Temp_ItemReference` | — | 0 |
| `TempDescuentos` | — | 132 |
| `TempDescuentoSP` | — | 1 |
| `TempDetailsSPs` | — | 2 |
| `TempFilterSPs` | — | 45 |
| `TempInvoiceSPs` | — | 2 |
| `TempItemReferences` | — | 19 |
| `TempRemainingSPs` | — | 6 |
| `TempReportSPDefs` | — | 4 |
| `TempTotalEfectivoSPs` | — | 2 |
| `TempTotalesSPs` | — | 3 |

### Legacy/vacío (NO migrar)

| Tabla original | Nueva | Filas |
|---|---|---|
| `OCPP_MeterValues` | — | 0 |
| `OCPP_Transaciones` | — | 0 |
| `ParkingConfig` | — | 0 |
| `MaqTabacoConfig` | — | 0 |
| `Manual Discount` | — | 0 |
| `Manual Discount Line` | — | 0 |
| `Extension_Ticket` | — | 0 |
| `POS Encuesta` | — | 0 |
| `POS Respuestas` | — | 0 |
| `POS_Tarjetas` | — | 0 |
| `POS Extraction_Return` | — | 0 |
| `POS Parked Line` | — | 0 |
| `POS Pump Meters` | — | 0 |
| `POS Sales VAT Specification` | — | 0 |
| `POS Tank Measuring Entries` | — | 0 |
| `ficohsa-tipos` | — | 6 |
| `ficohsa-voucher` | — | 0 |
| `Interface Menus` | — | 60 |
| `Shortcut` | — | 13 |
| `ShortcutGroups` | — | 3 |
| `StoreShortcuts` | — | 5 |
| `StoreLines` | — | 1 |
| `URLs` | — | 1 |
| `Parametros` | — | 166 |
| `users` | — | 0 |
| `products` | — | 0 |
| `sales` | — | 0 |
| `Usuario` | — | 2 |
| `PurchaseOrders` | — | 2 |
| `PurchaseOrdersEntry` | — | 2 |
| `Reparacion2` | — | 53 |
| `Sales Line Discount` | — | 0 |
| `Sales Rule & Inv_ Brdc_ Setup` | — | 0 |
| `TABs` | — | 6 |
| `TABdetail` | — | 36 |
| `CostingCodeSAP` | — | 5 |
| `Item Cross Reference` | — | 1 |
| `Item H24` | — | 0 |
| `Item SOLRED Equivalence` | — | 0 |
| `ItemReferences` | — | 19 |
| `Item_Franquicia` | — | 0 |
| `Item_Multibox` | — | 0 |
| `PROM Item Category` | — | 0 |
| `PROM POS Sales Line` | — | 1 |
| `PROM_Cab_Reglas_Aplicacion` | — | 0 |
| `PROM_Cab_Reglas_Evaluacion` | — | 0 |
| `PROM_Cab_Reglas_Generacion` | — | 0 |
| `PROM_Promociones` | — | 0 |
| `PROM_Reglas_Aplicacion` | — | 0 |
| `PROM_Reglas_Eval_Grupo_Cliente` | — | 0 |
| `PROM_Reglas_Evaluacion` | — | 0 |
| `PROM_Reglas_Fechas` | — | 0 |
| `PROM_Reglas_Gener_Charge_Method` | — | 0 |
| `PROM_Reglas_Gener_Grupo_Cliente` | — | 0 |
| `PROM_Reglas_Generacion` | — | 0 |
| `EmployeePresence` | — | 0 |
| `Forma_Pago` | — | 8 |


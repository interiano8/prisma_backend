-- CreateTable
CREATE TABLE "empleados" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT,
    "pin" TEXT,
    "usuario" TEXT NOT NULL,
    "perfil" TEXT,
    "esta_activo" BOOLEAN,
    "codigo_rfid" TEXT,
    "hash_contrasena" TEXT,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiendas" (
    "id_tienda" TEXT NOT NULL,
    "titulo" TEXT,
    "nombre" TEXT,
    "rtn" TEXT,
    "pais" TEXT,
    "estado" TEXT,
    "ciudad" TEXT,
    "direccion1" TEXT,
    "direccion2" TEXT,
    "direccion3" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "contrasena_admin" TEXT,
    "turnos" INTEGER,
    "d3" INTEGER,
    "d4" INTEGER,
    "transacciones_pendientes" INTEGER,
    "url_leal" TEXT,
    "leal_habilitado" BOOLEAN,
    "codigo_pais" TEXT,
    "es_controlador_gas" BOOLEAN,
    "aviso_nuevos_rangos_factura" INTEGER,
    "aviso_nuevos_rangos_nota_credito" INTEGER,
    "fusion_asignado" BOOLEAN,
    "ip_fusion" TEXT,
    "api" TEXT,
    "varias_lineas_permitidas" BOOLEAN,
    "descuentos_permitidos" BOOLEAN,
    "bloqueado_transacciones_pendientes" BOOLEAN,
    "modo_depuracion" BOOLEAN,
    "clave_fusion" TEXT,
    "codigo_consumidor_final" TEXT,
    "url_saldo" TEXT,
    "validar_rfid" BOOLEAN,
    "validar_saldo_credito" BOOLEAN,
    "vox_activo" BOOLEAN,
    "rango_individual" BOOLEAN,
    "facturacion_ordenada" BOOLEAN,
    "erp" TEXT,
    "url_actualizacion" TEXT,
    "url_base_erp" TEXT,
    "turno_manual" BOOLEAN,
    "calculo_inverso" BOOLEAN,
    "bloqueado_transacciones_bomba" BOOLEAN,
    "bloqueado_transacciones_turno" BOOLEAN,
    "sorteos" BOOLEAN,
    "declarar_monto_inicial" BOOLEAN,

    CONSTRAINT "tiendas_pkey" PRIMARY KEY ("id_tienda")
);

-- CreateTable
CREATE TABLE "configuracion_pos" (
    "id" SERIAL NOT NULL,
    "codigo_pos" TEXT,
    "pantalla_en_bomba" BOOLEAN,
    "bloquear_solo_pos" BOOLEAN,
    "mostrar_video_publicidad" BOOLEAN,
    "reimprimir_varios" BOOLEAN,
    "facturar_varias_lineas" BOOLEAN,
    "descuento_manual" BOOLEAN,
    "ocultar_boton_otras_bombas" BOOLEAN,
    "ocultar_informacion_turnos" BOOLEAN,
    "config" JSONB,

    CONSTRAINT "configuracion_pos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_tienda" (
    "id_tienda" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "configuracion_tienda_pkey" PRIMARY KEY ("id_tienda")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id_transaccion_pos" TEXT NOT NULL,
    "id_tienda" TEXT NOT NULL,
    "codigo_pos" TEXT NOT NULL,
    "turno" TEXT,
    "id_dia_semana" INTEGER,
    "inicio_turno" TIMESTAMPTZ(6) NOT NULL,
    "fin_turno" TIMESTAMPTZ(6),
    "importe_contado" DECIMAL(18,2) NOT NULL,
    "nombre_empleado" TEXT,
    "monto_inicial" DECIMAL(18,2),

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id_transaccion_pos")
);

-- CreateTable
CREATE TABLE "turnos_tienda" (
    "id" SERIAL NOT NULL,
    "turno" INTEGER,
    "hora_inicio" TIME(6),
    "hora_fin" TIME(6),

    CONSTRAINT "turnos_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_turnos" (
    "id" SERIAL NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "dia_semana" TEXT,
    "nombre_turno" TEXT,
    "hora_inicio" TIME(6),
    "hora_fin" TIME(6),
    "activo" BOOLEAN,
    "nivel" INTEGER,

    CONSTRAINT "configuracion_turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "grupo_descuento" TEXT,
    "codigo_pais" TEXT,
    "bloqueado" BOOLEAN,
    "rtn" TEXT,
    "codigo_postal" TEXT,
    "municipio" TEXT,
    "correo" TEXT,
    "tipo_facturacion" INTEGER,
    "estado" TEXT,
    "grupo_promo" TEXT,
    "tipo_actualizacion" INTEGER,
    "fecha_actualizacion" TIMESTAMPTZ(6),
    "bcid" TEXT,
    "fecha_nacimiento" DATE,
    "id_departamento" INTEGER,
    "id_municipio" INTEGER,
    "saldo_moneda_local" DECIMAL(18,2),
    "saldo" DECIMAL(18,2),
    "grupo_contable" TEXT,
    "grupo_contable_negocio" TEXT,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "productos" (
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio_unitario" DECIMAL(18,6),
    "bloqueado" BOOLEAN,
    "imagen" BYTEA,
    "grupo_isv" TEXT,
    "codigo_categoria" TEXT,
    "codigo_grupo" TEXT,
    "bonificado" BOOLEAN,
    "factor_conversion_um" DECIMAL(18,6),
    "codigo_um_etiquetas" TEXT,
    "genera_asiento_bomba" BOOLEAN,
    "grupo_descuento" TEXT,
    "permite_cambio_precio" BOOLEAN,
    "codigo_categoria_promo" TEXT,
    "permite_cantidad_negativa" BOOLEAN,
    "bc_id" TEXT,
    "id_proveedor" INTEGER,
    "aplica_descuento_edad" BOOLEAN,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "categorias_producto" (
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo_categoria" INTEGER,
    "tipo_actualizacion" INTEGER,
    "fecha_actualizacion" TIMESTAMPTZ(6),

    CONSTRAINT "categorias_producto_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "precios_producto" (
    "id" SERIAL NOT NULL,
    "codigo_producto" TEXT NOT NULL,
    "id_tienda" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6),
    "hora_inicio" TIMESTAMPTZ(6),
    "cantidad_minima" DECIMAL(18,6),
    "precio_unitario" DECIMAL(18,6),
    "fecha_fin" TIMESTAMPTZ(6),
    "hora_fin" TIMESTAMPTZ(6),
    "estado" BOOLEAN,

    CONSTRAINT "precios_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descuentos" (
    "codigo_cliente" TEXT NOT NULL,
    "codigo_producto" TEXT NOT NULL,
    "porcentaje" DECIMAL(18,6),
    "rtn_cliente" TEXT,
    "id_tienda" TEXT,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "monto_por_galon" DECIMAL(18,6),
    "monto_por_litro" DECIMAL(18,6),
    "precio_referencia" TEXT,
    "modo_ingreso" TEXT,
    "activo" BOOLEAN,

    CONSTRAINT "descuentos_pkey" PRIMARY KEY ("codigo_cliente","codigo_producto")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "excluir_resumen_turno" BOOLEAN,
    "usado_por" INTEGER NOT NULL,
    "tipo_cargo" INTEGER,
    "vencido_en_pos" BOOLEAN,
    "factura" BOOLEAN,
    "ticket" BOOLEAN,
    "credito" BOOLEAN,
    "referencia" BOOLEAN,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("codigo","usado_por")
);

-- CreateTable
CREATE TABLE "configuracion_isv" (
    "grupo_isv" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL,
    "isv" DECIMAL(18,6),
    "descripcion" TEXT,

    CONSTRAINT "configuracion_isv_pkey" PRIMARY KEY ("fecha_inicio","grupo_isv")
);

-- CreateTable
CREATE TABLE "series" (
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "iniciales" TEXT,

    CONSTRAINT "series_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "series_documento" (
    "numero_linea" INTEGER NOT NULL,
    "codigo_serie" TEXT NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "fecha_inicio" TIMESTAMPTZ(6),
    "numero_inicio" TEXT,
    "numero_fin" TEXT,
    "numero_aviso" TEXT,
    "incremento" INTEGER,
    "ultimo_numero_usado" TEXT,
    "abierta" BOOLEAN,
    "ultima_fecha_usada" TIMESTAMPTZ(6),
    "cai" TEXT,
    "rango_desde" TEXT,
    "rango_hasta" TEXT,
    "fecha_vence_rango" DATE,

    CONSTRAINT "series_documento_pkey" PRIMARY KEY ("numero_linea","codigo_serie")
);

-- CreateTable
CREATE TABLE "motivos" (
    "id" SERIAL NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "motivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasas_cambio" (
    "id" SERIAL NOT NULL,
    "tasa" DECIMAL(18,2),
    "fecha" DATE,

    CONSTRAINT "tasas_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "numero_emisor" TEXT NOT NULL,
    "id_transaccion_pos" TEXT NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "tipo_documento" INTEGER,
    "numero_documento" TEXT,
    "codigo_cliente" TEXT,
    "fecha_hora_venta" TIMESTAMPTZ(6),
    "monto" DECIMAL(18,2),
    "numero_tarjeta_cliente" TEXT,
    "numero_tarjeta_puntos" TEXT,
    "placa" TEXT,
    "documento_relacionado" TEXT,
    "codigo_vendedor" TEXT,
    "rtn_cliente" TEXT,
    "nombre_cliente" TEXT,
    "nombre_cliente2" TEXT,
    "direccion_cliente" TEXT,
    "direccion_cliente2" TEXT,
    "codigo_postal_cliente" TEXT,
    "ciudad_cliente" TEXT,
    "municipio_cliente" TEXT,
    "codigo_pais_cliente" TEXT,
    "tipo_facturacion" INTEGER,
    "correo_cliente" TEXT,
    "comentario" TEXT,
    "bc_id" TEXT,
    "numero_linea" INTEGER,
    "subtotal" DECIMAL(18,2),
    "kilometraje" TEXT,
    "orden" TEXT,
    "placa_orden" TEXT,
    "chofer" TEXT,
    "cambio" DECIMAL(18,2),

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("numero_emisor","id_transaccion_pos")
);

-- CreateTable
CREATE TABLE "lineas_venta" (
    "numero_emisor" TEXT NOT NULL,
    "id_transaccion_pos" TEXT NOT NULL,
    "numero_linea_documento" INTEGER NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "tipo_documento" INTEGER,
    "numero_documento" TEXT,
    "tipo_venta" INTEGER,
    "numero_venta" TEXT,
    "descripcion" TEXT,
    "cantidad" DECIMAL(18,6),
    "precio_unitario_con_isv" DECIMAL(18,6),
    "monto_descuento_unitario" DECIMAL(18,6),
    "descuento" DECIMAL(18,6),
    "monto_descuento_linea" DECIMAL(18,6),
    "isv" DECIMAL(18,6),
    "monto_isv" DECIMAL(18,6),
    "monto_con_isv" DECIMAL(18,6),
    "numero_bomba" TEXT,
    "posicion_bomba" TEXT,
    "numero_tanque" TEXT,
    "hora_operacion" TIMESTAMPTZ(6),
    "codigo_categoria" TEXT,
    "bonificado" BOOLEAN,
    "devuelto" BOOLEAN,
    "genera_asiento_bomba" BOOLEAN,
    "grupo_isv" TEXT,
    "id_transaccion_origen" TEXT,
    "documento_origen" TEXT,
    "linea_documento_origen" INTEGER,
    "numero_transaccion_doms" TEXT,
    "prepago" BOOLEAN,
    "devolucion" BOOLEAN,
    "numero_linea_aplicada" INTEGER,
    "puntos_fidelidad" DECIMAL(18,2),
    "id_despachador" INTEGER,
    "id_venta" TEXT,
    "monto_gravado" DECIMAL(18,2),

    CONSTRAINT "lineas_venta_pkey" PRIMARY KEY ("numero_emisor","numero_linea_documento","id_transaccion_pos")
);

-- CreateTable
CREATE TABLE "pagos_venta" (
    "numero_linea_pago" INTEGER NOT NULL,
    "id_transaccion_pos" TEXT NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "codigo_metodo_pago" TEXT,
    "monto" DECIMAL(18,2),
    "numero_tarjeta" TEXT,
    "descripcion" TEXT,
    "datos_adicionales" TEXT,
    "id_despachador" INTEGER,
    "tasa_cambio" DECIMAL(18,2),
    "monto_ingresado" DECIMAL(18,2),
    "es_ticket" BOOLEAN,

    CONSTRAINT "pagos_venta_pkey" PRIMARY KEY ("numero_linea_pago","id_transaccion_pos")
);

-- CreateTable
CREATE TABLE "ventas_leal" (
    "id" BIGSERIAL NOT NULL,
    "id_transaccion_pos" TEXT,
    "id_transaccion_leal" TEXT,
    "puntos" INTEGER,
    "puntos_activos" INTEGER,
    "tipo" INTEGER,
    "dni" TEXT,
    "nombre" TEXT,
    "id_aleatorio" BIGINT,

    CONSTRAINT "ventas_leal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_transacciones" (
    "id_transaccion_pos" TEXT NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "fecha_turno" TIMESTAMPTZ(6),
    "numero_turno" TEXT,
    "tipo_transaccion" INTEGER,
    "fecha_hora_transaccion" TIMESTAMPTZ(6),
    "estado" BOOLEAN,
    "nombre_empleado" TEXT,

    CONSTRAINT "registro_transacciones_pkey" PRIMARY KEY ("id_transaccion_pos")
);

-- CreateTable
CREATE TABLE "arqueos_caja" (
    "id" SERIAL NOT NULL,
    "id_transaccion_pos" TEXT,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "codigo_metodo_pago" TEXT,
    "descripcion_metodo_pago" TEXT,
    "monto" DECIMAL(18,2),
    "codigo_vendedor" TEXT,
    "numero_documento" TEXT,
    "codigo_cliente" TEXT,
    "comentario" TEXT,

    CONSTRAINT "arqueos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mangueras" (
    "id_manguera" INTEGER NOT NULL,
    "numero_grado" INTEGER,
    "nombre_grado" TEXT,
    "precio_unitario" DECIMAL(10,2),
    "ids_tanques" TEXT,
    "id_bomba" INTEGER,
    "id_manguera_fisica" INTEGER,
    "pos" TEXT,
    "codigo_pos" TEXT,
    "codigo_generico" TEXT,
    "visible" BOOLEAN,

    CONSTRAINT "mangueras_pkey" PRIMARY KEY ("id_manguera")
);

-- CreateTable
CREATE TABLE "despachadores" (
    "id" SERIAL NOT NULL,
    "id_tienda" TEXT,
    "codigo_pos" TEXT,
    "id_despachador" INTEGER,
    "nombres" TEXT,
    "apellidos" TEXT,
    "dni" TEXT,

    CONSTRAINT "despachadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_leal" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT,
    "contrasena" TEXT,

    CONSTRAINT "configuracion_leal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorteos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT,
    "fecha_inicio" TIMESTAMPTZ(6),
    "fecha_fin" TIMESTAMPTZ(6),
    "activo" BOOLEAN,
    "texto_ticket" TEXT,

    CONSTRAINT "sorteos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condiciones_sorteo" (
    "id" SERIAL NOT NULL,
    "id_sorteo" INTEGER,
    "tipo_evaluacion" TEXT,
    "operador" TEXT,
    "valor_texto" TEXT,
    "valor_monto" DECIMAL(18,2),
    "valor_cantidad" DECIMAL(18,6),
    "valor_requerido" TEXT,

    CONSTRAINT "condiciones_sorteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premios_sorteo" (
    "id" SERIAL NOT NULL,
    "numero_documento_venta" TEXT,
    "nombre" TEXT,
    "telefono" TEXT,
    "frecuencia" INTEGER,
    "prioridad" TEXT,
    "estado" TEXT,
    "eliminado" BOOLEAN,
    "id_usuario" INTEGER,
    "creado_en" TIMESTAMPTZ(6),

    CONSTRAINT "premios_sorteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_sorteo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT,
    "usuario" TEXT,
    "contrasena" TEXT,
    "rol" TEXT,
    "activo" BOOLEAN,
    "creado_en" TIMESTAMPTZ(6),
    "actualizado_en" TIMESTAMPTZ(6),

    CONSTRAINT "usuarios_sorteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_sorteo" (
    "id" SERIAL NOT NULL,
    "id_transaccion_pos" TEXT,
    "correlativo" TEXT,
    "id_sorteo" INTEGER,

    CONSTRAINT "ventas_sorteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_surtidor" (
    "id" SERIAL NOT NULL,
    "id_bomba" INTEGER,
    "id_raspberry" TEXT,
    "estado" TEXT,
    "id_empleado_inicio" INTEGER,
    "nombre_empleado_inicio" TEXT,
    "hora_inicio" TIMESTAMPTZ(6),
    "id_empleado_fin" INTEGER,
    "nombre_empleado_fin" TEXT,
    "hora_fin" TIMESTAMPTZ(6),
    "manguera" TEXT,
    "id_venta" TEXT,
    "fue_despacho" BOOLEAN,

    CONSTRAINT "sesiones_surtidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_combustible" (
    "id_venta" INTEGER NOT NULL,
    "numero_pos" INTEGER,
    "numero_bomba" INTEGER,
    "numero_manguera" TEXT,
    "monto" DECIMAL(18,2),
    "precio_unitario" DECIMAL(18,6),
    "volumen" DECIMAL(18,6),
    "volumen_final" DECIMAL(18,6),
    "volumen_inicial" DECIMAL(18,6),
    "tipo_pago" TEXT,
    "info_pago" TEXT,
    "temperatura_compensada" TEXT,
    "id_turno" TEXT,
    "numero_grado" INTEGER,
    "nivel_precio" INTEGER,
    "tipo_transaccion" TEXT,
    "fecha_transaccion" TEXT,
    "hora_transaccion" TEXT,
    "monto_preestablecido" DECIMAL(18,2),
    "alarma_pago" TEXT,
    "atcvo" TEXT,
    "avgtm" TEXT,
    "atcivo" TEXT,
    "atcfvo" TEXT,
    "facturada" BOOLEAN,
    "fecha" TIMESTAMPTZ(6),

    CONSTRAINT "ventas_combustible_pkey" PRIMARY KEY ("id_venta")
);

-- CreateTable
CREATE TABLE "reintentos_venta_combustible" (
    "id_venta_vox" INTEGER NOT NULL,
    "payload" TEXT,
    "intentos" INTEGER,
    "ultimo_intento" TIMESTAMPTZ(6),
    "mensaje_error" TEXT,

    CONSTRAINT "reintentos_venta_combustible_pkey" PRIMARY KEY ("id_venta_vox")
);

-- CreateTable
CREATE TABLE "mapeo_lector_bomba" (
    "id" SERIAL NOT NULL,
    "ruta_lector" TEXT,
    "id_bomba" INTEGER,
    "id_raspberry" TEXT,

    CONSTRAINT "mapeo_lector_bomba_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empleados_usuario_key" ON "empleados"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_pos_codigo_pos_key" ON "configuracion_pos"("codigo_pos");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sorteo_usuario_key" ON "usuarios_sorteo"("usuario");

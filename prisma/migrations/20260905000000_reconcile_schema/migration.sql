-- CreateEnum
CREATE TYPE "tipo_beneficio" AS ENUM ('PORCENTAJE', 'MONTO_FIJO', 'MONTO_VOLUMEN');

-- CreateEnum
CREATE TYPE "unidad_volumen" AS ENUM ('GALON', 'LITRO');

-- CreateEnum
CREATE TYPE "tipo_evaluacion" AS ENUM ('TOTAL_FACTURA', 'CANTIDAD_ITEM', 'CATEGORIA', 'TIPO_CLIENTE', 'SIN_DESCUENTO', 'SIN_ACUMULAR_PUNTOS');

-- CreateEnum
CREATE TYPE "operador" AS ENUM ('GTE', 'LTE', 'EQ', 'NEQ', 'IN', 'CONTAINS');

-- CreateEnum
CREATE TYPE "modo_evaluacion" AS ENUM ('ALL', 'ANY');

-- AlterTable
ALTER TABLE "configuracion_pos" ALTER COLUMN "visualizacion" DROP NOT NULL,
ALTER COLUMN "visualizacion" DROP DEFAULT;

-- AlterTable
ALTER TABLE "metodos_pago" DROP CONSTRAINT "metodos_pago_pkey",
DROP COLUMN "credito",
DROP COLUMN "excluir_resumen_turno",
DROP COLUMN "factura",
DROP COLUMN "referencia",
DROP COLUMN "ticket",
DROP COLUMN "tipo_cargo",
DROP COLUMN "usado_por",
DROP COLUMN "vencido_en_pos",
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "categoria" TEXT NOT NULL DEFAULT 'EFECTIVO',
ADD COLUMN     "factura_contado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "factura_credito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fidelizacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "genera_cambio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imagen" TEXT,
ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'HNL',
ADD COLUMN     "requiere_referencia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salida_combustible" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "descripcion" SET NOT NULL,
ADD CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("codigo");

-- AlterTable
ALTER TABLE "pagos_venta" ADD COLUMN     "numero_emisor" TEXT;

-- AlterTable
ALTER TABLE "series_documento" ADD COLUMN     "en_edicion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tiendas" DROP COLUMN "sorteos",
ADD COLUMN     "campanas" BOOLEAN,
ADD COLUMN     "emisor" TEXT,
ALTER COLUMN "nombre_boton_fidelizacion" DROP DEFAULT,
ALTER COLUMN "moneda" DROP DEFAULT;

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "detalle_pagos" JSONB;

-- AlterTable
ALTER TABLE "ventas" DROP COLUMN "ciudad_cliente",
DROP COLUMN "codigo_pais_cliente",
DROP COLUMN "codigo_postal_cliente",
DROP COLUMN "correo_cliente",
DROP COLUMN "direccion_cliente",
DROP COLUMN "direccion_cliente2",
DROP COLUMN "municipio_cliente",
DROP COLUMN "nombre_cliente2",
DROP COLUMN "numero_tarjeta_cliente",
DROP COLUMN "numero_tarjeta_puntos",
ADD COLUMN     "cai" TEXT,
ADD COLUMN     "fecha_vence_rango" DATE,
ADD COLUMN     "rango_desde" TEXT,
ADD COLUMN     "rango_hasta" TEXT;

-- AlterTable
ALTER TABLE "ventas_leal" ADD COLUMN     "numero_emisor" TEXT;

-- DropTable
DROP TABLE "arqueos_caja";

-- DropTable
DROP TABLE "condiciones_sorteo";

-- DropTable
DROP TABLE "configuracion_isv";

-- DropTable
DROP TABLE "configuracion_turnos";

-- DropTable
DROP TABLE "descuentos";

-- DropTable
DROP TABLE "despachadores";

-- DropTable
DROP TABLE "mapeo_lector_bomba";

-- DropTable
DROP TABLE "premios_sorteo";

-- DropTable
DROP TABLE "reintentos_venta_combustible";

-- DropTable
DROP TABLE "series";

-- DropTable
DROP TABLE "sesiones_surtidor";

-- DropTable
DROP TABLE "sorteos";

-- DropTable
DROP TABLE "turnos_tienda";

-- DropTable
DROP TABLE "usuarios_sorteo";

-- DropTable
DROP TABLE "ventas_sorteo";

-- CreateTable
CREATE TABLE "reglas_descuento" (
    "id" TEXT NOT NULL,
    "codigo_cliente" TEXT,
    "codigo_producto" TEXT,
    "codigo_categoria" TEXT,
    "cantidad_minima" DECIMAL(18,6),
    "tipo_beneficio" "tipo_beneficio" NOT NULL,
    "valor" DECIMAL(18,6) NOT NULL,
    "unidad_volumen" "unidad_volumen",
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_tienda" TEXT,

    CONSTRAINT "reglas_descuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea_venta_descuento_aplicado" (
    "numero_emisor" TEXT NOT NULL,
    "numero_linea_documento" INTEGER NOT NULL,
    "id_transaccion_pos" TEXT NOT NULL,
    "id_regla" TEXT NOT NULL,
    "tipo_beneficio" "tipo_beneficio" NOT NULL,
    "valor" DECIMAL(18,6) NOT NULL,
    "monto_aplicado" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "linea_venta_descuento_aplicado_pkey" PRIMARY KEY ("numero_emisor","numero_linea_documento","id_transaccion_pos","id_regla")
);

-- CreateTable
CREATE TABLE "grupos_impuesto" (
    "codigo" TEXT NOT NULL,
    "tasa" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "grupos_impuesto_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "media_programacion" (
    "id" SERIAL NOT NULL,
    "archivo" TEXT NOT NULL,
    "tipo" TEXT,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "media_programacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT,
    "fecha_inicio" TIMESTAMPTZ(6),
    "fecha_fin" TIMESTAMPTZ(6),
    "activo" BOOLEAN,
    "texto_ticket" TEXT,
    "modo_evaluacion" "modo_evaluacion" NOT NULL DEFAULT 'ALL',
    "limite_por_cliente" INTEGER,

    CONSTRAINT "campanas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condiciones_campana" (
    "id" SERIAL NOT NULL,
    "id_campana" INTEGER,
    "tipo_evaluacion" "tipo_evaluacion" NOT NULL,
    "operador" "operador" NOT NULL,
    "valor_texto" TEXT,
    "valor_monto" DECIMAL(18,2),
    "valor_cantidad" DECIMAL(18,6),

    CONSTRAINT "condiciones_campana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participaciones_campana" (
    "id" SERIAL NOT NULL,
    "id_transaccion_pos" TEXT,
    "correlativo" TEXT,
    "id_campana" INTEGER,
    "codigo_cliente" TEXT,

    CONSTRAINT "participaciones_campana_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reglas_descuento_codigo_cliente_codigo_producto_codigo_cate_idx" ON "reglas_descuento"("codigo_cliente", "codigo_producto", "codigo_categoria", "activo");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_codigo_categoria_fkey" FOREIGN KEY ("codigo_categoria") REFERENCES "categorias_producto"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_venta_descuento_aplicado" ADD CONSTRAINT "linea_venta_descuento_aplicado_numero_emisor_numero_linea__fkey" FOREIGN KEY ("numero_emisor", "numero_linea_documento", "id_transaccion_pos") REFERENCES "lineas_venta"("numero_emisor", "numero_linea_documento", "id_transaccion_pos") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_venta_descuento_aplicado" ADD CONSTRAINT "linea_venta_descuento_aplicado_id_regla_fkey" FOREIGN KEY ("id_regla") REFERENCES "reglas_descuento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_codigo_vendedor_fkey" FOREIGN KEY ("codigo_vendedor") REFERENCES "empleados"("usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_codigo_categoria_fkey" FOREIGN KEY ("codigo_categoria") REFERENCES "categorias_producto"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_numero_emisor_id_transaccion_pos_fkey" FOREIGN KEY ("numero_emisor", "id_transaccion_pos") REFERENCES "ventas"("numero_emisor", "id_transaccion_pos") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_numero_emisor_id_transaccion_pos_fkey" FOREIGN KEY ("numero_emisor", "id_transaccion_pos") REFERENCES "ventas"("numero_emisor", "id_transaccion_pos") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_leal" ADD CONSTRAINT "ventas_leal_numero_emisor_id_transaccion_pos_fkey" FOREIGN KEY ("numero_emisor", "id_transaccion_pos") REFERENCES "ventas"("numero_emisor", "id_transaccion_pos") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condiciones_campana" ADD CONSTRAINT "condiciones_campana_id_campana_fkey" FOREIGN KEY ("id_campana") REFERENCES "campanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones_campana" ADD CONSTRAINT "participaciones_campana_id_campana_fkey" FOREIGN KEY ("id_campana") REFERENCES "campanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;


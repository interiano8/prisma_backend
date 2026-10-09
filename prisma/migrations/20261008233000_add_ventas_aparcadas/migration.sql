-- Crear enum de estado para ventas aparcadas
CREATE TYPE "estado_venta_aparcada" AS ENUM ('PARKED', 'RESUMED', 'DISCARDED', 'EXPIRED');

-- Crear tabla ventas_aparcadas
CREATE TABLE "ventas_aparcadas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "pos_no" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "cliente" JSONB,
    "items" JSONB NOT NULL,
    "nota" TEXT,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "estado" "estado_venta_aparcada" NOT NULL DEFAULT 'PARKED',
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_aparcadas_pkey" PRIMARY KEY ("id")
);

-- Índices de consulta rápida
CREATE INDEX "ventas_aparcadas_store_id_estado_idx" ON "ventas_aparcadas"("store_id", "estado");
CREATE INDEX "ventas_aparcadas_store_id_usuario_turno_id_idx" ON "ventas_aparcadas"("store_id", "usuario", "turno_id");

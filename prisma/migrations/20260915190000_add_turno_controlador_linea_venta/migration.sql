-- Turno del controlador de Fusion en cada línea de venta de combustible.
ALTER TABLE "lineas_venta" ADD COLUMN "turno_controlador" TEXT NULL;
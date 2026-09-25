-- Guardar la unidad de medida vendida (texto) en cada línea de venta.
ALTER TABLE "lineas_venta" ADD COLUMN "unidad_medida" TEXT NULL;
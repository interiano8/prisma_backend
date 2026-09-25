-- Unificar la unidad de medida en lineas_venta: se elimina el enum (la unidad
-- queda en "unidad_medida" como texto). El tipo enum sigue en reglas_descuento.
ALTER TABLE "lineas_venta" DROP COLUMN "unidad_volumen";
-- Turno del POS en la cabecera de la venta.
ALTER TABLE "ventas" ADD COLUMN "id_turno" TEXT NULL;
ALTER TABLE "ventas" ADD COLUMN "numero_turno" TEXT NULL;
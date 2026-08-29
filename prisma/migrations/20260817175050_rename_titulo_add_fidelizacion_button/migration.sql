-- Renombra la columna titulo -> casa_matriz preservando datos.
ALTER TABLE "tiendas" RENAME COLUMN "titulo" TO "casa_matriz";

-- Nombre del botón de Fidelización (LEAL por defecto).
ALTER TABLE "tiendas" ADD COLUMN "nombre_boton_fidelizacion" TEXT DEFAULT 'LEAL';
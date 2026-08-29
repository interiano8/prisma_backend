-- Moneda por defecto para mostrar los montos (ej. L. para Lempiras).
ALTER TABLE "tiendas" ADD COLUMN "moneda" TEXT DEFAULT 'L.';

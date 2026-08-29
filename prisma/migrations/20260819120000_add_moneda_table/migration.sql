-- Tabla de monedas. Cada precio puede indicar su moneda mediante FK.
CREATE TABLE "monedas" (
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "simbolo" TEXT,
    "decimales" INTEGER NOT NULL DEFAULT 2,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "monedas_pkey" PRIMARY KEY ("codigo")
);

-- AlterTable
ALTER TABLE "tiendas" ADD COLUMN "codigo_moneda" TEXT;
ALTER TABLE "productos" ADD COLUMN "codigo_moneda" TEXT;
ALTER TABLE "precios_producto" ADD COLUMN "codigo_moneda" TEXT;
ALTER TABLE "mangueras" ADD COLUMN "codigo_moneda" TEXT;

-- Seed de monedas por defecto.
INSERT INTO "monedas" ("codigo", "descripcion", "simbolo", "decimales", "activa")
VALUES
  ('HNL', 'Lempira', 'L.', 2, true),
  ('USD', 'Dólar', '$', 2, true)
ON CONFLICT ("codigo") DO NOTHING;

-- Backfill de filas existentes a la moneda por defecto (HNL).
UPDATE "tiendas" SET "codigo_moneda" = 'HNL' WHERE "codigo_moneda" IS NULL;
UPDATE "productos" SET "codigo_moneda" = 'HNL' WHERE "codigo_moneda" IS NULL;
UPDATE "precios_producto" SET "codigo_moneda" = 'HNL' WHERE "codigo_moneda" IS NULL;
UPDATE "mangueras" SET "codigo_moneda" = 'HNL' WHERE "codigo_moneda" IS NULL;

-- AddForeignKey
ALTER TABLE "tiendas" ADD CONSTRAINT "tiendas_codigo_moneda_fkey" FOREIGN KEY ("codigo_moneda") REFERENCES "monedas"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "productos" ADD CONSTRAINT "productos_codigo_moneda_fkey" FOREIGN KEY ("codigo_moneda") REFERENCES "monedas"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "precios_producto" ADD CONSTRAINT "precios_producto_codigo_moneda_fkey" FOREIGN KEY ("codigo_moneda") REFERENCES "monedas"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mangueras" ADD CONSTRAINT "mangueras_codigo_moneda_fkey" FOREIGN KEY ("codigo_moneda") REFERENCES "monedas"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
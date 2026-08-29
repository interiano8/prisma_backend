-- Nueva tabla de códigos de barras (varios por producto).
CREATE TABLE "codigos_barras" (
    "id" SERIAL NOT NULL,
    "codigo_producto" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,

    CONSTRAINT "codigos_barras_pkey" PRIMARY KEY ("id")
);

-- Migrar códigos de barras existentes desde productos.
INSERT INTO "codigos_barras" ("codigo_producto", "codigo")
SELECT "codigo", "codigo_barras"
FROM "productos"
WHERE "codigo_barras" IS NOT NULL AND btrim("codigo_barras") <> '';

CREATE UNIQUE INDEX "codigos_barras_codigo_producto_codigo_key" ON "codigos_barras"("codigo_producto", "codigo");

-- Los precios viven solo en precios_producto; se elimina el precio base del producto.
ALTER TABLE "productos" DROP COLUMN "precio_unitario";

-- Los códigos de barras ya no viven en productos.
ALTER TABLE "productos" DROP COLUMN "codigo_barras";

-- AddForeignKey
ALTER TABLE "codigos_barras" ADD CONSTRAINT "codigos_barras_codigo_producto_fkey" FOREIGN KEY ("codigo_producto") REFERENCES "productos"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
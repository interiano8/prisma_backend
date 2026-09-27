#!/bin/sh
set -e

echo "=========================================================="
echo "    [POS Local - Prisma Backend] Iniciando contenedor     "
echo "=========================================================="

echo "[POS Local] Esperando disponibilidad de PostgreSQL POS Local..."
until pnpm prisma db push --accept-data-loss; do
  echo "[POS Local] PostgreSQL no listo aún para inicializar esquema. Reintentando en 3s..."
  sleep 3
done

echo "[POS Local] Esquema de base de datos sincronizado con éxito."

if [ -f "scripts/seed-pos-local.js" ]; then
  echo "[POS Local] Ejecutando siembra de datos iniciales para validación..."
  node scripts/seed-pos-local.js || true
fi

echo "[POS Local] Arrancando Prisma Backend POS en puerto ${PORT:-5012}..."
exec node dist/src/main

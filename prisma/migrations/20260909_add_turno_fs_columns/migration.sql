-- Add Fusion reconciliation columns to turnos
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "fs_shift_id" TEXT;
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "turno_conciliador" TEXT;

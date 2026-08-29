import { Prisma } from '../../generated/prisma/client';

export interface LockedSeriesRow {
  numeroLinea: number;
  ultimoNumeroUsado: string | null;
  numeroInicio: string | null;
  numeroFin: string | null;
  cai: string | null;
  fechaVenceRango: Date | null;
}

/**
 * Lee y bloquea la fila de la serie de correlativos con `SELECT ... FOR UPDATE`.
 *
 * Evita la carrera de asignación de números consecutivos cuando varios POS
 * facturan en paralelo: la segunda transacción espera a que la primera haga
 * commit (bloqueo de fila, corto y acotado) y lee el valor ya actualizado.
 * El aislamiento por defecto (ReadCommitted) hace que este bloqueo solo afecte
 * a la misma serie (mismo codigoPos), nunca a otras series o a otros POS.
 */
export async function lockSeriesForUpdate(
  tx: Prisma.TransactionClient,
  seriesCode: string,
  gasStationCode: string,
  posNo: string,
  now: Date,
  withVenceRange: boolean,
): Promise<LockedSeriesRow | null> {
  const venceFilter = withVenceRange
    ? Prisma.sql`AND (fecha_vence_rango IS NULL OR fecha_vence_rango >= ${now})`
    : Prisma.empty;

  const rows = await tx.$queryRaw<LockedSeriesRow[]>`
    SELECT
      numero_linea AS "numeroLinea",
      ultimo_numero_usado AS "ultimoNumeroUsado",
      numero_inicio AS "numeroInicio",
      numero_fin AS "numeroFin",
      cai AS "cai",
      fecha_vence_rango AS "fechaVenceRango"
    FROM series_documento
    WHERE codigo_serie = ${seriesCode}
      AND abierta = true
      AND id_tienda = ${gasStationCode}
      AND codigo_pos = ${posNo}
      AND fecha_inicio <= ${now}
      ${venceFilter}
    ORDER BY numero_linea ASC
    LIMIT 1
    FOR UPDATE
  `;

  return rows[0] ?? null;
}

import { Prisma } from '../../generated/prisma/client';

export interface LockedSeriesRow {
  numeroLinea: number;
  ultimoNumeroUsado: string | null;
  numeroInicio: string | null;
  numeroFin: string | null;
  cai: string | null;
  fechaVenceRango: Date | null;
  remaining: number;
  remainingDays: number;
}

/** Extrae el tail numérico (los dígitos finales) de un correlativo, robusto a
 *  formatos CAI (FV/NC), internos (TR/TK) y prefijos inconsistentes. */
function trailingNum(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export interface LockedSeriesCandidate {
  numeroLinea: number;
  ultimoNumeroUsado: string | null;
  numeroInicio: string | null;
  numeroFin: string | null;
  cai: string | null;
  fechaVenceRango: Date | null;
  enEdicion: boolean;
}

/**
 * Lee y bloquea la fila de la serie de correlativos con `SELECT ... FOR UPDATE`,
 * eligiendo el rango abierto más antiguo con vigencia en FECHA y CANTIDAD.
 *
 * - Cierra automáticamente los rangos agotados por cantidad (`abierta=false`) y
 *   salta al siguiente válido.
 * - Cierra los rangos vencidos por fecha.
 * - Si el rango del POS está `en_edicion`, rechaza (no se factura mientras se edita).
 */
export async function lockSeriesForUpdate(
  tx: Prisma.TransactionClient,
  seriesCode: string,
  gasStationCode: string,
  posNo: string,
  now: Date,
  withVenceRange: boolean,
): Promise<LockedSeriesRow | null> {
  if (withVenceRange && tx.serieDocumento?.updateMany) {
    await tx.serieDocumento.updateMany({
      where: {
        codigoSerie: seriesCode,
        idTienda: gasStationCode,
        codigoPos: posNo,
        abierta: true,
        fechaVenceRango: { lt: now },
      },
      data: { abierta: false },
    });
  }

  const venceFilter = withVenceRange
    ? Prisma.sql`AND (fecha_vence_rango IS NULL OR fecha_vence_rango >= ${now})`
    : Prisma.empty;

  const rows = await tx.$queryRaw<LockedSeriesCandidate[]>`
    SELECT
      numero_linea AS "numeroLinea",
      ultimo_numero_usado AS "ultimoNumeroUsado",
      numero_inicio AS "numeroInicio",
      numero_fin AS "numeroFin",
      cai AS "cai",
      fecha_vence_rango AS "fechaVenceRango",
      en_edicion AS "enEdicion"
    FROM series_documento
    WHERE codigo_serie = ${seriesCode}
      AND abierta = true
      AND id_tienda = ${gasStationCode}
      AND codigo_pos = ${posNo}
      AND fecha_inicio <= ${now}
      ${venceFilter}
    ORDER BY numero_linea ASC
    FOR UPDATE
  `;

  if (rows.length === 0) return null;

  if (rows.some((r) => r.enEdicion)) {
    throw new Error(
      `La serie ${seriesCode} del POS ${posNo} está en edición; no se puede facturar hasta guardar/cancelar.`,
    );
  }

  for (const row of rows) {
    const next = trailingNum(row.ultimoNumeroUsado) + 1;
    const fin = trailingNum(row.numeroFin);
    if (fin !== 0 && next > fin) {
      await tx.serieDocumento.updateMany({
        where: { numeroLinea: row.numeroLinea, codigoSerie: seriesCode },
        data: { abierta: false },
      });
      continue;
    }

    const remaining = Math.max(0, fin - trailingNum(row.ultimoNumeroUsado));
    const remainingDays = row.fechaVenceRango
      ? Math.max(
          0,
          Math.floor((row.fechaVenceRango.getTime() - now.getTime()) / 86400000),
        )
      : 0;

    return {
      numeroLinea: row.numeroLinea,
      ultimoNumeroUsado: row.ultimoNumeroUsado,
      numeroInicio: row.numeroInicio,
      numeroFin: row.numeroFin,
      cai: row.cai,
      fechaVenceRango: row.fechaVenceRango,
      remaining,
      remainingDays,
    };
  }

  return null;
}
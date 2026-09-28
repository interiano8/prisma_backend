export interface SerieRow {
  numeroLinea: number;
  codigoSerie: string;
  idTienda: string | null;
  codigoPos: string | null;
  fechaInicio: Date | null;
  numeroInicio: string | null;
  numeroFin: string | null;
  numeroAviso: string | null;
  incremento: number | null;
  ultimoNumeroUsado: string | null;
  abierta: boolean | null;
  cai: string | null;
  rangoDesde: string | null;
  rangoHasta: string | null;
  fechaVenceRango: Date | null;
  enEdicion: boolean;
  remaining: number;
  remainingDays: number;
}

export interface SerieWrite {
  codigoSerie: string;
  idTienda: string;
  codigoPos: string;
  fechaInicio?: string | null;
  numeroInicio: string;
  numeroFin: string;
  numeroAviso?: number | null;
  incremento?: number | null;
  ultimoNumeroUsado?: string | null;
  cai?: string | null;
  rangoDesde?: string | null;
  rangoHasta?: string | null;
  fechaVenceRango?: string | null;
  abierta?: boolean;
}

export interface SeriesRepository {
  list(storeId?: string, posNo?: string): Promise<SerieRow[]>;
  create(data: SerieWrite): Promise<{ numeroLinea: number }>;
  update(
    numeroLinea: number,
    codigoSerie: string,
    data: Partial<SerieWrite>,
  ): Promise<void>;
  close(numeroLinea: number, codigoSerie: string): Promise<void>;
  setEditing(
    numeroLinea: number,
    codigoSerie: string,
    editing: boolean,
  ): Promise<void>;
}
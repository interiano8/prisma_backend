export interface TasaCambioRow {
  id: number;
  tasa: number;
  fecha: Date | null;
}

export interface TasaCambioRepository {
  list(): Promise<TasaCambioRow[]>;
  create(data: { tasa: number; fecha?: Date }): Promise<TasaCambioRow>;
  update(
    id: number,
    data: { tasa?: number; fecha?: Date },
  ): Promise<TasaCambioRow>;
  delete(id: number): Promise<void>;
}
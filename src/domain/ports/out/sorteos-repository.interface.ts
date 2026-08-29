export interface SorteoCondition {
  TipoEvaluacion: string;
  ValorRequerido: string;
  ValorTexto: string;
  ValorMonto: number;
  ValorCantidad: number;
  Operador: string;
}

export interface ActiveSorteo {
  SorteoID: number;
  Nombre: string;
  TextoTicket: string | null;
}

export interface ItemCategoryRow {
  No_: string | null;
  'Item Category Code': string;
}

export interface SorteosRepository {
  getActiveSorteos(): Promise<ActiveSorteo[]>;
  getFuelCodes(): Promise<string[]>;
  getItemCategories(codes: string[]): Promise<ItemCategoryRow[]>;
  getSorteoConditions(sorteoId: number): Promise<SorteoCondition[]>;
  saveWonSorteo(
    posTransactionId: string,
    correlativo: string,
    sorteoId: number,
  ): Promise<void>;
}

export interface ItemCategoryRow {
  No_: string;
  'Item Category Code': string;
}

export interface CampanaActiva {
  CampanaID: number;
  Nombre: string;
  TextoTicket: string | null;
  ModoEvaluacion: 'ALL' | 'ANY';
  LimitePorCliente: number | null;
}

export interface CondicionCampanaRow {
  id: number;
  TipoEvaluacion: string;
  Operador: string;
  ValorTexto: string;
  ValorMonto: number;
  ValorCantidad: number;
}

export interface CampanaAdmin {
  id: number;
  nombre: string | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  activo: boolean | null;
  textoTicket: string | null;
  modoEvaluacion: 'ALL' | 'ANY';
  limitePorCliente: number | null;
  condiciones: CondicionCampanaRow[];
  participacionesCount: number;
}

export interface CampanaWrite {
  nombre: string | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  activo: boolean;
  textoTicket: string | null;
  modoEvaluacion: 'ALL' | 'ANY';
  limitePorCliente: number | null;
}

export interface CondicionWrite {
  tipoEvaluacion: string;
  operador: string;
  valorTexto: string | null;
  valorMonto: number | null;
  valorCantidad: number | null;
}

export interface TicketVerificacion {
  correlativo: string;
  campanaId: number;
  nombreCampana: string;
  idTransaccionPos: string;
  codigoCliente: string | null;
}

export interface CampanasRepository {
  getActiveCampanas(tx?: any): Promise<CampanaActiva[]>;
  getCampanaConditions(
    campanaId: number,
    tx?: any,
  ): Promise<CondicionCampanaRow[]>;
  getItemCategories(codes: string[], tx?: any): Promise<ItemCategoryRow[]>;
  countParticipaciones(
    campanaId: number,
    codigoCliente: string,
    tx?: any,
  ): Promise<number>;
  saveParticipacion(
    params: {
      posTransactionId: string;
      correlativo: string;
      campanaId: number;
      codigoCliente: string | null;
    },
    tx?: any,
  ): Promise<void>;
  getTicketByCorrelativo(
    correlativo: string,
  ): Promise<TicketVerificacion | null>;
  listCampanas(): Promise<CampanaAdmin[]>;
  createCampana(data: CampanaWrite): Promise<{ id: number }>;
  updateCampana(id: number, data: CampanaWrite): Promise<{ id: number }>;
  deleteCampana(id: number): Promise<void>;
  createCondicion(
    campanaId: number,
    data: CondicionWrite,
  ): Promise<{ id: number }>;
  updateCondicion(id: number, data: CondicionWrite): Promise<{ id: number }>;
  deleteCondicion(id: number): Promise<void>;
}
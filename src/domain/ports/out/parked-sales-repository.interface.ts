export type EstadoVentaAparcada = 'PARKED' | 'RESUMED' | 'DISCARDED' | 'EXPIRED';

export interface VentaAparcadaData {
  id: string;
  codigo: string;
  storeId: string;
  posNo: string;
  usuario: string;
  turnoId: string;
  cliente?: any;
  items: any[];
  nota?: string | null;
  total: number;
  estado: EstadoVentaAparcada;
  fechaCreacion: Date;
  fechaActualizado: Date;
}

export interface CreateVentaAparcadaInput {
  storeId: string;
  posNo: string;
  usuario: string;
  turnoId: string;
  cliente?: any;
  items: any[];
  nota?: string | null;
  total: number;
}

export interface ParkedSalesRepository {
  create(input: CreateVentaAparcadaInput): Promise<VentaAparcadaData>;
  listActive(storeId: string): Promise<VentaAparcadaData[]>;
  findById(id: string): Promise<VentaAparcadaData | null>;
  markResumed(id: string): Promise<VentaAparcadaData>;
  markDiscarded(id: string): Promise<VentaAparcadaData>;
  expirePendingByShift(storeId: string, usuario: string, turnoId: string): Promise<number>;
}

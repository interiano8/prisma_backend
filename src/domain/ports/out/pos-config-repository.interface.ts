export interface PosConfig {
  mostrarBombas: boolean | null;
  ocultarBotonOtrasBombas: boolean | null;
  numTransaccionesBombas: number | null;
  minutosAtrasada: number | null;
  mostrarTeclado: boolean | null;
  declararMontosIniciales: boolean | null;
  config?: unknown;
}

export interface PosConfigUpdateData {
  mostrarBombas?: boolean;
  ocultarBotonOtrasBombas?: boolean;
  numTransaccionesBombas?: number;
  minutosAtrasada?: number;
  mostrarTeclado?: boolean;
  declararMontosIniciales?: boolean;
  config?: unknown;
}

export interface PosConfigRepository {
  findByPos(posNo: string): Promise<PosConfig | null>;
  upsert(posNo: string, data: PosConfigUpdateData): Promise<void>;
}

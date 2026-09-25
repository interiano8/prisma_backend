import { StoreConfig } from '../../entities/store-config.entity';

export interface StoreConfigRepository {
  findByStoreId(storeId: string): Promise<StoreConfig | null>;
  findBlockedForPendingTransactions(storeId: string): Promise<boolean>;
  /** tiendas.bloqueado_transacciones_bomba (caso 1: por cara). */
  findBlockedForPendingBomba(storeId: string): Promise<boolean>;
  /** tiendas.bloqueado_transacciones_turno (caso 2: por turno de Fusion). */
  findBlockedForPendingTurno(storeId: string): Promise<boolean>;
  findHideShiftInfo(posCode: string): Promise<boolean>;
  findExchangeRate(fecha: string): Promise<number>;
  findTasaByGrupo(codigo: string): Promise<number>;
  update(storeId: string, data: Partial<StoreConfig>): Promise<StoreConfig>;
}

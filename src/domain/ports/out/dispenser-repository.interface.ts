import { HoseConfig } from '../../entities/hose-config.entity';
import { PumpTransaction } from '../../entities/pump-transaction.entity';

export interface PendingSaleRecord {
  SaleID: number;
  PumpNumber: number;
  amount: number;
  ppu: number;
  volume: number;
  GradeNr: number | null;
  IsInvoiced: boolean;
}

export interface SaleRecord {
  PumpNumber: number;
  HoseNumber: string;
  amount: number;
  ppu: number;
  volume: number;
  GradeNr: number | null;
  IsInvoiced: boolean;
}

export interface HoseFsMapping {
  CodigoPOS: string | null;
  TankIDs: string | null;
}

export interface ItemMetadata {
  Description: string | null;
  'VAT Prod_ Posting Group': string | null;
  'Item Category Code': string | null;
  'Gen_ Pump Ledg_ Entry': number;
}

export interface SimpleHoseConfig {
  pumpId: number;
  productName: string | null;
  unitPrice: number;
  pos: string | null;
}

export interface FuelSaleCreateInput {
  idVenta: number;
  numeroPos: number | null;
  numeroBomba: number | null;
  numeroManguera: string | null;
  monto: number | null;
  precioUnitario: number | null;
  volumen: number | null;
  volumenFinal: number | null;
  volumenInicial: number | null;
  tipoPago: string | null;
  infoPago: string | null;
  temperaturaCompensada: string | null;
  idTurno: string | null;
  numeroGrado: number | null;
  nivelPrecio: number | null;
  tipoTransaccion: string | null;
  fechaTransaccion: string | null;
  horaTransaccion: string | null;
  montoPreestablecido: number | null;
  alarmaPago: string | null;
  atcvo: string | null;
  avgtm: string | null;
  atcivo: string | null;
  atcfvo: string | null;
  facturada: boolean;
  fecha: Date | null;
}

export interface HosePumpId {
  PumpID: number | null;
}

export interface DispenserRepository {
  getPendingSales(): Promise<PendingSaleRecord[]>;
  getSaleById(saleId: number): Promise<SaleRecord | null>;
  getHoseFsMapping(
    pumpId: number,
    hoseNumber: number,
  ): Promise<HoseFsMapping | null>;
  getItemMetadata(itemCode: string): Promise<ItemMetadata | null>;
  getHoseConfigs(): Promise<HoseConfig[]>;
  getSimpleHoseConfigs(): Promise<SimpleHoseConfig[]>;
  getPumpTransactions(
    pumpId: number,
    limit?: number,
  ): Promise<PumpTransaction[]>;
  updateSaleInvoiced(saleId: string, posNumber: string): Promise<void>;
  reverseFusionSale(saleId: string): Promise<void>;
  renewTransactions(): Promise<number>;
  getHoseFsForPos(posNo: string): Promise<HosePumpId[]>;
  countPendingSalesForPos(posNo: string): Promise<number>;
  getExistingSaleIds(): Promise<number[]>;
  createSales(data: FuelSaleCreateInput[]): Promise<number>;
}

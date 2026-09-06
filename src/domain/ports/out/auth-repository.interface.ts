import { User } from '../../entities/user.entity';
import { StoreConfig } from '../../entities/store-config.entity';

export interface RawStore {
  StoreID: string | null;
  Titulo: string | null;
  Name: string | null;
  RTN: string | null;
  Country: string | null;
  State: string | null;
  City: string | null;
  Address1: string | null;
  Address2: string | null;
  Address3: string | null;
  Phone: string | null;
  Email: string | null;
  PassAdmin: string | null;
  Turnos: number | null;
  D3: number | null;
  D4: number | null;
  NumberOfTransactionsWaiting: number | null;
  URLLEAL: string | null;
  isLealEnabled: number;
  CodeCountry: string | null;
  IsGasController: number;
  WarningNewInvoiceRanges: number | null;
  WarningNewCreditNotesRanges: number | null;
  IsFusionAssigned: number;
  IPFusionController: string | null;
  Api: string | null;
  MultipleItemsAllowed: number;
  AllowedToApplyDiscounts: number;
  BlockedForPendingTransactions: number;
  DebugMode: number;
  FusionControllerKey: string | null;
  NoConsumidorFinal: string | null;
  URLSaldo: string | null;
  ValidarRFID: number;
  ValidarSaldoCredito: number;
  VoxIsActive: number;
  RangoIndividual: number;
  FacturacionOrdenada: number;
  ERP: string | null;
  Url_Actualizacion: string | null;
  URLBaseERP: string | null;
  Turno_Manual: number;
  Calculo_Inverso: number;
  Campanas: number;
  DeclararMontoInicial: number;
}

export interface ActiveShiftResult {
  Shift: string | null;
  'POS Transaction ID'?: string;
  'Shift Starting'?: string;
  MontoInicial?: unknown;
  EmployeeName?: string;
  Message?: string;
}

export interface AuthRepository {
  findUserByUsername(username: string): Promise<User | null>;
  listEmployees(): Promise<{ usuario: string; nombre: string }[]>;
  findUserByRfid(rfidCode: string): Promise<User | null>;
  findStoreByStoreId(storeId: string): Promise<StoreConfig | null>;
  findStoreRaw(storeId: string): Promise<RawStore | null>;
  findTpvConfig(posNo: string): Promise<unknown>;
  findPosConfig(posNo: string): Promise<{
    mostrarBombas: boolean;
    ocultarBotonOtrasBombas: boolean;
    numTransaccionesBombas: number;
    minutosAtrasada: number;
    mostrarTeclado: boolean;
    declararMontosIniciales: boolean;
  } | null>;
  findPassAdmin(storeId: string): Promise<string | null>;
  updatePassAdmin(storeId: string, hash: string): Promise<void>;
  checkCreditValidation(storeId: string): Promise<boolean>;
  getActiveShift(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<ActiveShiftResult>;
  savePreferences(
    username: string,
    preferences: { theme?: string; accent?: string },
  ): Promise<void>;
}

import {
  LealCustomer,
  LealLoginResponse,
} from '../../entities/leal-transaction.entity';

export interface LealTransactionResult {
  code?: number;
  id_transaccion?: string;
  puntos?: number;
  puntos_activos?: number;
  mensaje?: string;
  message?: string;
  data?: {
    id_transaccion?: string;
    puntos?: number;
    puntos_activos?: number;
    premios?: any[];
  };
}

export interface LealCustomerResult {
  uid: string;
  documentId: string;
  nombre: string;
  apellido: string;
  fullname: string;
  email: string;
  celular: string;
  puntos: number;
  status: string;
  tier: string;
}

export interface LealTotales {
  SubTotal?: number;
  ImpuestoTotal?: number;
  DescuentoTotal?: number;
  FormaPago?: string;
  TotalPersonas?: number;
  Fecha?: string;
  FechaApertura?: string;
  FechaCierre?: string;
  Items?: any[];
}

export interface LealRepository {
  login(credentials: {
    username: string;
    password: string;
    storeId: string;
  }): Promise<LealLoginResponse>;
  checkStatus(): Promise<{
    connected: boolean;
    idComercio?: any;
    tieneOtp?: boolean;
  }>;
  searchCustomer(
    documentId: string,
    soloCedula: string,
    token: string,
  ): Promise<LealCustomerResult | null>;
  getPremios(uid: string, token: string): Promise<any>;
  registerCustomer(data: {
    documentId: string;
    name: string;
    email: string;
    phone: string;
    token: string;
  }): Promise<LealCustomer>;
  accumulatePoints(data: {
    customerId: string;
    invoiceNo: string;
    noFactura?: string;
    total: number;
    token: string;
    totales?: LealTotales;
    pin?: string;
  }): Promise<any>;
  redeemPoints(data: {
    customerId: string;
    points: number;
    invoiceNo: string;
    token: string;
    idPremio?: number;
    otp?: string;
    pin?: string;
    nota?: string;
  }): Promise<any>;
  reverseTransaction(
    transactionId: string,
    invoiceNo: string,
    token: string,
  ): Promise<any>;
  generateOtp(
    uid: string,
    idPremio?: number,
    idSucursal?: string,
  ): Promise<any>;
  getCredentials(): Promise<{ user: string; pass: string }>;
  updateCredentials(user: string, pass: string): Promise<void>;
}

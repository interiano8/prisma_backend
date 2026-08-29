export interface PaymentMethod {
  code: string;
  description: string;
  categoria: string;
  facturaContado: boolean;
  facturaCredito: boolean;
  salidaCombustible: boolean;
  fidelizacion: boolean;
  requiereReferencia: boolean;
  imagen: string | null;
  activo: boolean;
}

export interface PaymentAllocation {
  code: number;
  description: string;
  amount: number;
  exchangeRate?: number;
  amountEntered?: number;
  reference?: string;
  isInvoice: boolean;
  additionalData?: string;
  summary?: string;
}

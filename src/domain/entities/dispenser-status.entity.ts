export interface DispenserStatus {
  pumpId: number;
  state: string;
  productName: string;
  gallons: number;
  amount: number;
  unitPrice: number;
  limitAmount: number | null;
  saleId?: number | null;
}

export interface AuthorizePumpCommand {
  pumpId: number;
  limitAmount: number;
}

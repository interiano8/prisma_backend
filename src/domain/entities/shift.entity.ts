export interface Shift {
  id: number;
  isOpen: boolean;
  shiftNumber: string;
  storeId: string;
  posNo: string;
  posCierre?: string | null;
  employeeName: string;
  initialAmount: number;
  actualAmount: number | null;
  posTransactionId: string;
  shiftStarting: Date;
  shiftEnding: Date | null;
}

export interface ShiftInfo {
  Shift: string | null;
  'POS Transaction ID': string;
  'Shift Starting': string;
  Message?: string;
}

export interface OpenShiftCommand {
  storeId: string;
  posNo: string;
  employeeName: string;
  initialAmount: number;
  shiftNumber?: number;
}

export interface CloseShiftCommand {
  storeId: string;
  posNo: string;
  employeeName: string;
  actualAmount: number;
}

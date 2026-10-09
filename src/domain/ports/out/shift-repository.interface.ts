import {
  Shift,
  OpenShiftCommand,
  CloseShiftCommand,
} from '../../entities/shift.entity';

export interface AvailableShift {
  Turno: string | null;
  PosCode: string | null;
  Cajero: string | null;
}

export interface ShiftSalesLine {
  numeroBomba: string | null;
  descripcion: string | null;
  montoConIsv: number | null;
  grupoIsv: string | null;
  montoIsv: number | null;
  montoDescuentoLinea: number | null;
  cantidad: number | null;
  unidadMedida: string | null;
}

export interface ShiftSalePayment {
  descripcion: string | null;
  codigoMetodoPago: string | null;
  /** Nombre real del método (metodoPago.descripcion) resuelto por código. */
  metodoPago: string | null;
  monto: number | null;
  montoIngresado: number | null;
}

export interface ShiftSaleHeader {
  monto: number | null;
  tipoDocumento: number | null;
  origenValidacionCredito?: string | null;
}

export interface SalesReportData {
  lines: ShiftSalesLine[];
  payments: ShiftSalePayment[];
  headers: ShiftSaleHeader[];
}

export interface DbOpenShiftResult {
  Message?: string;
  Shift: string | null;
  'POS Transaction ID'?: string;
  'Shift Starting'?: string;
  MontoInicial?: unknown;
  EmployeeName?: string | null;
  message?: string;
  shift?: string;
  posTransactionId?: string;
  shiftStarting?: string;
}

export interface ShiftRepository {
  findOpenShift(
    storeId: string,
    posNo: string,
    employeeName?: string,
  ): Promise<Shift | null>;
  findOpenShiftFromDb(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<DbOpenShiftResult>;
  getOpenShiftByEmployee(
    storeId: string,
    employeeName: string,
  ): Promise<DbOpenShiftResult>;
  createShift(dto: OpenShiftCommand): Promise<Shift>;
  closeShift(dto: CloseShiftCommand): Promise<{ success: boolean }>;
  /** sale_ids (fusion) de las ventas del turno abierto del empleado. */
  getOpenShiftSaleIds(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<number[]>;
  countTurnoControladorByPeriod(periodId: string): Promise<number>;
  createTurnoControlador(data: {
    periodId: string;
    startDate: string;
    startTime: string;
    additionalDetails: string;
  }): Promise<void>;
  getAvailableShifts(
    storeId: string,
    fechaTurno: string,
  ): Promise<AvailableShift[]>;
  getSalesReportData(
    storeId: string,
    turno: string,
    employeeName: string,
    fechaTurno: string,
  ): Promise<SalesReportData>;
  getShiftReclassifications(shiftId: string): Promise<any[]>;
}

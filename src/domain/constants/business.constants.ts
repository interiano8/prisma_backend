export const SERIES = {
  FACTURA: 'FV-HN',
  NOTA_CREDITO: 'NC-HN',
  TICKET: 'TK-HN',
  TRANSACCION: 'TR-ID',
} as const;

export const TIPO_DOCUMENTO = {
  FACTURA: 1,
  CREDITO: 2,
  NOTA_CREDITO: 3,
  TICKET: 4,
} as const;

export const TIPO_TRANSACCION = {
  FACTURA: 1,
  TICKET: 2,
  NOTA_CREDITO: 3,
  CIERRE: 4,
} as const;

export const FUEL_DEFAULT_CODE = 'SUPER';
export const FUEL_CODE_PREFIX = 'GAS-';

// Corresponden a MetodoPago.categoria (FIDELIZACION / CREDITO / SALIDA).
export const LEAL_EXCLUDED_KEYWORDS = [
  'LEAL',
  'CREDITO',
  'CALIBRACION',
  'CRÉDITO',
] as const;
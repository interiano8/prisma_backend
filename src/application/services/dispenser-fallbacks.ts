import { FUEL_DEFAULT_CODE } from '../../domain/constants/business.constants';
import type {
  HoseFSFullRow,
  LocalDispenser,
  PumpTransaction,
} from './dispensers.service';

export const FALLBACK_HOSES: HoseFSFullRow[] = [
  {
    id: 1,
    hoseId: 1,
    gradeNumber: 1,
    gradeName: 'DIESEL',
    pricePerUnit: 29.21,
    pumpId: 1,
    hosePhysicalId: 1,
    codigoPos: 'DIESEL',
    esVisible: true,
  },
  {
    id: 2,
    hoseId: 2,
    gradeNumber: 3,
    gradeName: 'REGULAR',
    pricePerUnit: 27.93,
    pumpId: 1,
    hosePhysicalId: 2,
    codigoPos: 'REGULAR',
    esVisible: true,
  },
  {
    id: 3,
    hoseId: 3,
    gradeNumber: 2,
    gradeName: FUEL_DEFAULT_CODE,
    pricePerUnit: 26.86,
    pumpId: 1,
    hosePhysicalId: 3,
    codigoPos: FUEL_DEFAULT_CODE,
    esVisible: true,
  },
  {
    id: 4,
    hoseId: 4,
    gradeNumber: 1,
    gradeName: 'DIESEL',
    pricePerUnit: 29.21,
    pumpId: 2,
    hosePhysicalId: 1,
    codigoPos: 'DIESEL',
    esVisible: true,
  },
  {
    id: 5,
    hoseId: 5,
    gradeNumber: 3,
    gradeName: 'REGULAR',
    pricePerUnit: 27.93,
    pumpId: 2,
    hosePhysicalId: 2,
    codigoPos: 'REGULAR',
    esVisible: true,
  },
  {
    id: 6,
    hoseId: 6,
    gradeNumber: 2,
    gradeName: FUEL_DEFAULT_CODE,
    pricePerUnit: 26.86,
    pumpId: 2,
    hosePhysicalId: 3,
    codigoPos: FUEL_DEFAULT_CODE,
    esVisible: true,
  },
  {
    id: 7,
    hoseId: 7,
    gradeNumber: 1,
    gradeName: 'DIESEL',
    pricePerUnit: 29.21,
    pumpId: 3,
    hosePhysicalId: 1,
    codigoPos: 'DIESEL',
    esVisible: true,
  },
  {
    id: 8,
    hoseId: 8,
    gradeNumber: 3,
    gradeName: 'REGULAR',
    pricePerUnit: 27.93,
    pumpId: 3,
    hosePhysicalId: 2,
    codigoPos: 'REGULAR',
    esVisible: true,
  },
  {
    id: 9,
    hoseId: 9,
    gradeNumber: 2,
    gradeName: FUEL_DEFAULT_CODE,
    pricePerUnit: 26.86,
    pumpId: 3,
    hosePhysicalId: 3,
    codigoPos: FUEL_DEFAULT_CODE,
    esVisible: true,
  },
  {
    id: 10,
    hoseId: 10,
    gradeNumber: 1,
    gradeName: 'DIESEL',
    pricePerUnit: 29.21,
    pumpId: 4,
    hosePhysicalId: 1,
    codigoPos: 'DIESEL',
    esVisible: true,
  },
  {
    id: 11,
    hoseId: 11,
    gradeNumber: 3,
    gradeName: 'REGULAR',
    pricePerUnit: 27.93,
    pumpId: 4,
    hosePhysicalId: 2,
    codigoPos: 'REGULAR',
    esVisible: true,
  },
  {
    id: 12,
    hoseId: 12,
    gradeNumber: 2,
    gradeName: FUEL_DEFAULT_CODE,
    pricePerUnit: 26.86,
    pumpId: 4,
    hosePhysicalId: 3,
    codigoPos: FUEL_DEFAULT_CODE,
    esVisible: true,
  },
];

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatTime = (d: Date) => {
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${min}:${ss}`;
};

export function buildMockPumpTransactions(
  pumpId: number,
  local: LocalDispenser | undefined,
  now: Date,
): PumpTransaction[] {
  const mockList: PumpTransaction[] = [];

  if (local && (local.state === 'colgada' || local.amount > 0)) {
    mockList.push({
      saleId: local.saleId || 998100 + pumpId,
      posNumber: 1,
      pumpNumber: pumpId,
      hoseNumber: 'A',
      grade: (local.productName || 'SUPER').toUpperCase(),
      combustible: local.productName || 'SUPER',
      unidad: 'galones',
      precio: local.unitPrice,
      cantidad: local.gallons,
      estado: 'Sin Facturar',
      amount: local.amount,
      ciclo: 'Libre',
      date: now.toISOString(),
      fecha: formatDate(now),
      hora: formatTime(now),
      despachador: 'JEFE TURNO',
    });
  }

  const delayedTime = new Date(now.getTime() - 40 * 60 * 1000);
  mockList.push({
    saleId: 998010 + pumpId * 10,
    posNumber: 1,
    pumpNumber: pumpId,
    hoseNumber: 'B',
    grade: 'SUPER',
    combustible: 'SUPER',
    unidad: 'galones',
    precio: 30.5,
    cantidad: 16.3934,
    estado: 'Sin Facturar',
    amount: 500.0,
    ciclo: 'Atrasada',
    date: delayedTime.toISOString(),
    fecha: formatDate(delayedTime),
    hora: formatTime(delayedTime),
    despachador: 'OPERADOR B',
  });

  const billedTime = new Date(now.getTime() - 15 * 60 * 1000);
  mockList.push({
    saleId: 998005 + pumpId * 10,
    posNumber: 1,
    pumpNumber: pumpId,
    hoseNumber: 'C',
    grade: 'REGULAR',
    combustible: 'REGULAR',
    unidad: 'galones',
    precio: 28.2,
    cantidad: 10.6383,
    estado: 'Facturado',
    amount: 300.0,
    ciclo: 'Finalizada',
    date: billedTime.toISOString(),
    fecha: formatDate(billedTime),
    hora: formatTime(billedTime),
    despachador: 'OPERADOR A',
  });

  return mockList;
}

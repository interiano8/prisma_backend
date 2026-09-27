export interface Product {
  code: string;
  description: string;
  unitPrice: number;
  category: string;
  vatGroup: string;
  priceIncludesVat: boolean;
  blocked?: boolean;
  codigosBarras?: string[];
  unidadMedida?: string;
  codigoMoneda?: string;
  simboloMoneda?: string;
}

export type TipoBeneficio = 'PORCENTAJE' | 'MONTO_FIJO' | 'MONTO_VOLUMEN';
export type UnidadVolumen = 'GALON' | 'LITRO';

export interface DiscountRule {
  id: string;
  codigoCliente?: string;
  codigoProducto?: string;
  codigoCategoria?: string;
  cantidadMinima?: number;
  tipoBeneficio: TipoBeneficio;
  valor: number;
  unidadVolumen?: UnidadVolumen;
  prioridad: number;
  acumulable?: boolean;
}

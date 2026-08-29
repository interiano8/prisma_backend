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

export interface Discount {
  codigoCliente: string;
  codigoItem: string;
  porcentaje: number;
  customerRTN?: string;
  storeID?: string;
  startingDate?: string;
  endingDate?: string;
  amountPerGallon?: number;
  amountPerLiter?: number;
  referenceUnitPrice?: number;
  entryMode?: string;
  active?: boolean;
}

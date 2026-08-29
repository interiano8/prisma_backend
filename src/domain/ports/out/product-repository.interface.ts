import { Product, Discount } from '../../entities/product.entity';

export interface ProductView {
  code: string;
  description: string | null;
  unitPrice: number;
  category: string;
  vatGroup: string;
  priceIncludesVat: boolean;
  codigosBarras?: string[];
  unidadMedida?: string;
  codigoMoneda?: string;
  simboloMoneda?: string;
}

export interface DiscountCalculation {
  code: string;
  hasDiscount: boolean;
  discountPercentage: number;
  quantity: number;
  unitPriceWithIsv: number;
  unitPriceWithoutIsv: number;
  unitPriceWithDiscount: number;
  isvAmountUnit: number;
  totalWithoutIsv: number;
  totalDiscount: number;
  totalIsv: number;
  finalTotal: number;
}

export interface ProductRepository {
  findAll(category?: string): Promise<Product[]>;
  findByCode(code: string): Promise<Product | null>;
  findByBarcode(barcode: string): Promise<Product | null>;
  findDiscount(
    itemCode: string,
    customerCode: string,
  ): Promise<Discount | null>;
  calculateDiscount(
    itemCode: string,
    customerCode: string,
    quantity: number,
    vatGroup: string,
    unitPrice: number,
  ): Promise<DiscountCalculation | null>;
  getDefaultStoreId(): Promise<string>;
  getProductsFiltered(
    category: string,
    storeId: string,
  ): Promise<ProductView[]>;
  getProductsAll(storeId: string): Promise<ProductView[]>;
}

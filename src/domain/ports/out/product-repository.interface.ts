import { Product, DiscountRule } from '../../entities/product.entity';

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

export interface ProductCategory {
  codigo: string;
  descripcion: string | null;
  count: number;
}

export interface ProductRepository {
  findAll(category?: string): Promise<Product[]>;
  listCategories(): Promise<ProductCategory[]>;
  findByCode(code: string): Promise<Product | null>;
  findByBarcode(barcode: string): Promise<Product | null>;
  findApplicableDiscountRules(
    customerCode: string,
    productCode: string,
    categoryCode: string,
  ): Promise<DiscountRule[]>;
  getDefaultStoreId(): Promise<string>;
  getProductsFiltered(
    category: string,
    storeId: string,
  ): Promise<ProductView[]>;
  getProductsAll(storeId: string): Promise<ProductView[]>;
}

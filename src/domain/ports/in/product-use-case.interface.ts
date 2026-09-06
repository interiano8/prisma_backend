import { Product } from '../../entities/product.entity';

export interface ProductUseCase {
  getProducts(category?: string): Promise<Product[]>;
  getProductByCode(code: string): Promise<Product | null>;
}

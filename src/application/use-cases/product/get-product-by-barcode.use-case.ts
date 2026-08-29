import { Injectable } from '@nestjs/common';
import type { ProductRepository } from '../../../domain/ports/out/product-repository.interface';
import { Product } from '../../../domain/entities/product.entity';

@Injectable()
export class GetProductByBarcodeUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(barcode: string): Promise<Product | null> {
    return this.productRepository.findByBarcode(barcode);
  }
}

import { Injectable } from '@nestjs/common';
import type { ProductRepository } from '../../../domain/ports/out/product-repository.interface';
import { Product } from '../../../domain/entities/product.entity';

@Injectable()
export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(category?: string): Promise<Product[]> {
    return this.productRepository.findAll(category);
  }
}

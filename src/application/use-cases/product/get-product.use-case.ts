import { Injectable } from '@nestjs/common';
import type { ProductRepository } from '../../../domain/ports/out/product-repository.interface';
import { Product } from '../../../domain/entities/product.entity';

@Injectable()
export class GetProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(code: string): Promise<Product | null> {
    return this.productRepository.findByCode(code);
  }
}

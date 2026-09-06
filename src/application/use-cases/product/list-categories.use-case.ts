import { Injectable } from '@nestjs/common';
import type { ProductRepository } from '../../../domain/ports/out/product-repository.interface';

@Injectable()
export class ListCategoriesUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute() {
    return this.productRepository.listCategories();
  }
}
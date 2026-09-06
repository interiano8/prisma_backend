import { Injectable } from '@nestjs/common';
import type { PrecioProducto } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ProductRepository,
  ProductView,
  ProductCategory,
} from '../../../domain/ports/out/product-repository.interface';
import { Product, DiscountRule } from '../../../domain/entities/product.entity';

@Injectable()
export class ProductRepositoryImpl implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async getDefaultStoreIdInternal(): Promise<string> {
    const store = await this.prisma.tienda.findFirst();
    return store?.idTienda || '001';
  }

  async getDefaultStoreId(): Promise<string> {
    return this.getDefaultStoreIdInternal();
  }

  async listCategories(): Promise<ProductCategory[]> {
    const [cats, prods] = await Promise.all([
      this.prisma.categoriaProducto.findMany(),
      this.prisma.producto.findMany({
        where: { bloqueado: false },
        select: { codigoCategoria: true },
      }),
    ]);
    const descMap = new Map<string, string | null>(
      cats.map((c) => [c.codigo, c.descripcion]),
    );
    const counts = new Map<string, number>();
    for (const p of prods) {
      if (!p.codigoCategoria) continue;
      counts.set(p.codigoCategoria, (counts.get(p.codigoCategoria) || 0) + 1);
    }
    const titleCase = (s: string) =>
      s
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const out: ProductCategory[] = [];
    for (const [codigo, count] of counts) {
      out.push({
        codigo,
        descripcion: descMap.get(codigo) || titleCase(codigo),
        count,
      });
    }
    out.sort((a, b) =>
      (a.descripcion || '').localeCompare(b.descripcion || ''),
    );
    return out;
  }

  async findAll(category?: string): Promise<Product[]> {
    const storeId = await this.getDefaultStoreIdInternal();
    const rows = await this.queryProducts(storeId, category);
    return rows.map((r) => this.mapProduct(r));
  }

  async findByCode(code: string): Promise<Product | null> {
    const storeId = await this.getDefaultStoreIdInternal();
    const rows = await this.queryProducts(storeId, undefined);
    const row = rows.find((r) => r.code === code);
    return row ? this.mapProduct(row) : null;
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    const storeId = await this.getDefaultStoreIdInternal();
    const rows = await this.queryProducts(storeId, undefined);
    const needle = barcode.trim().toLowerCase();
    const row = rows.find(
      (r) =>
        (r.codigosBarras || []).find(
          (b) => b.trim().toLowerCase() === needle,
        ) !== undefined,
    );
    return row ? this.mapProduct(row) : null;
  }

  async getProductsFiltered(
    category: string,
    storeId: string,
  ): Promise<ProductView[]> {
    const fuelCodes = await this.getFuelCodes();
    const rows = await this.queryProducts(storeId, category);
    return rows.filter(
      (r) => !fuelCodes.includes((r.code || '').toUpperCase()),
    );
  }

  async getProductsAll(storeId: string): Promise<ProductView[]> {
    const fuelCodes = await this.getFuelCodes();
    const rows = await this.queryProducts(storeId, undefined);
    return rows.filter(
      (r) => !fuelCodes.includes((r.code || '').toUpperCase()),
    );
  }

  private async getFuelCodes(): Promise<string[]> {
    const mangueras = await this.prisma.manguera.findMany({
      select: { codigoPos: true },
    });
    return mangueras
      .map((m) => (m.codigoPos || '').trim().toUpperCase())
      .filter((c) => c);
  }

  private async queryProducts(
    storeId: string,
    category?: string,
  ): Promise<ProductView[]> {
    const prices = await this.prisma.precioProducto.findMany({
      where: {
        idTienda: storeId,
        estado: true,
        fechaInicio: { lte: new Date() },
        OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }],
      },
      orderBy: { horaInicio: 'asc' },
    });
    const priceByItem = new Map<string, PrecioProducto>();
    for (const p of prices) {
      if (!priceByItem.has(p.codigoProducto))
        priceByItem.set(p.codigoProducto, p);
    }

    const items = await this.prisma.producto.findMany({
      where: { bloqueado: false },
      include: { moneda: true, codigosBarras: true },
    });

    const results: ProductView[] = [];
    for (const item of items) {
      if (category && item.codigoCategoria !== category) continue;
      const price = priceByItem.get(item.codigo);
      results.push({
        code: item.codigo,
        description: item.descripcion,
        unitPrice: price ? Number(price.precioUnitario) : 0,
        category: item.codigoCategoria || '',
        vatGroup: item.grupoIsv || '',
        priceIncludesVat: true,
        codigosBarras: (item.codigosBarras ?? []).map((b) => b.codigo),
        unidadMedida: item.codigoUmEtiquetas || undefined,
        codigoMoneda: item.moneda?.codigo,
        simboloMoneda: item.moneda?.simbolo || undefined,
      });
    }
    return results;
  }

  async findApplicableDiscountRules(
    customerCode: string,
    productCode: string,
    categoryCode: string,
  ): Promise<DiscountRule[]> {
    const now = new Date();
    const rows = await this.prisma.reglaDescuento.findMany({
      where: {
        activo: true,
        AND: [
          { OR: [{ fechaInicio: null }, { fechaInicio: { lte: now } }] },
          { OR: [{ fechaFin: null }, { fechaFin: { gte: now } }] },
          { OR: [{ codigoCliente: customerCode }, { codigoCliente: null }] },
          { OR: [{ codigoProducto: productCode }, { codigoProducto: null }] },
          { OR: [{ codigoCategoria: categoryCode }, { codigoCategoria: null }] },
        ],
      },
    });
    return rows.map((r) => ({
      id: r.id,
      codigoCliente: r.codigoCliente ?? undefined,
      codigoProducto: r.codigoProducto ?? undefined,
      codigoCategoria: r.codigoCategoria ?? undefined,
      cantidadMinima: r.cantidadMinima != null ? Number(r.cantidadMinima) : undefined,
      tipoBeneficio: r.tipoBeneficio,
      valor: Number(r.valor),
      unidadVolumen: r.unidadVolumen ?? undefined,
      prioridad: r.prioridad,
    }));
  }

  private mapProduct(row: ProductView): Product {
    return {
      code: row.code,
      description: row.description || '',
      unitPrice: row.unitPrice || 0,
      category: row.category || '',
      vatGroup: row.vatGroup || '',
      priceIncludesVat: row.priceIncludesVat !== false,
      blocked: false,
      codigosBarras: row.codigosBarras,
      unidadMedida: row.unidadMedida,
      codigoMoneda: row.codigoMoneda,
      simboloMoneda: row.simboloMoneda,
    };
  }
}

import { Injectable } from '@nestjs/common';
import type { PrecioProducto } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ProductRepository,
  ProductView,
  DiscountCalculation,
} from '../../../domain/ports/out/product-repository.interface';
import { Product, Discount } from '../../../domain/entities/product.entity';

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

  async findDiscount(
    itemCode: string,
    customerCode: string,
  ): Promise<Discount | null> {
    const row = await this.prisma.descuento.findUnique({
      where: {
        codigoCliente_codigoProducto: {
          codigoCliente: customerCode,
          codigoProducto: itemCode,
        },
      },
    });
    if (!row || row.activo !== true) return null;
    return {
      codigoCliente: row.codigoCliente,
      codigoItem: row.codigoProducto,
      porcentaje: Number(row.porcentaje) || 0,
      customerRTN: row.rtnCliente ?? undefined,
      storeID: row.idTienda ?? undefined,
      startingDate: row.fechaInicio ? row.fechaInicio.toISOString() : undefined,
      endingDate: row.fechaFin ? row.fechaFin.toISOString() : undefined,
      amountPerGallon: Number(row.montoPorGalon) || undefined,
      amountPerLiter: Number(row.montoPorLitro) || undefined,
      referenceUnitPrice: row.precioReferencia
        ? Number(row.precioReferencia)
        : undefined,
      entryMode: row.modoIngreso ?? undefined,
      active: row.activo === true,
    };
  }

  async calculateDiscount(
    itemCode: string,
    customerCode: string,
    quantity: number,
    vatGroup: string,
    unitPrice: number,
  ): Promise<DiscountCalculation> {
    // Reimplementa sp_CalcularTotalConDescuentoYISV
    let tipoIsv = 0;
    if (vatGroup.includes('15')) tipoIsv = 15;
    else if (vatGroup.includes('18')) tipoIsv = 18;

    const discount = await this.findDiscount(itemCode, customerCode);
    const percentage = discount?.porcentaje || 0;

    const unitPriceWithoutIsv = unitPrice / (1 + tipoIsv / 100);
    const discountFactor = 1 - percentage / 100;
    const unitPriceWithDiscount = unitPrice * discountFactor;
    const isvUnitario =
      unitPriceWithDiscount - unitPriceWithDiscount / (1 + tipoIsv / 100);

    const totalSinIsv = quantity * unitPriceWithoutIsv;
    const totalDiscount = quantity * unitPrice * (percentage / 100);
    const totalIsv = quantity * isvUnitario;
    const finalTotal = quantity * unitPriceWithDiscount;

    return {
      code: itemCode,
      hasDiscount: percentage > 0,
      discountPercentage: percentage,
      quantity,
      unitPriceWithIsv: unitPrice,
      unitPriceWithoutIsv,
      unitPriceWithDiscount,
      isvAmountUnit: isvUnitario,
      totalWithoutIsv: totalSinIsv,
      totalDiscount,
      totalIsv,
      finalTotal,
    };
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

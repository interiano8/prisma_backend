import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProductStockCheckResult {
  productCode: string;
  stock: number;
  minStock: number;
  isAvailable: boolean;
  source: 'HQ' | 'LOCAL_OFFLINE';
  updatedAt: string | null;
}

export interface NetworkStockItem {
  storeCode: string;
  storeName: string;
  stock: number;
  minStock: number;
  isAvailable: boolean;
  updatedAt: string | null;
}

export interface NetworkStockResult {
  productCode: string;
  items: NetworkStockItem[];
  totalNetworkStock: number;
  source: 'HQ' | 'LOCAL_OFFLINE';
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  getBaseHqInventoryUrl(): string {
    const raw = (process.env.BACKOFFICE_SYNC_URL || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    // Strip trailing /sync if present to reach base api
    const base = raw.replace(/\/sync$/, '');
    return `${base}/api/inventory`;
  }

  async checkProductStock(productCode: string): Promise<ProductStockCheckResult> {
    const cleanCode = (productCode || '').trim();
    const storeCode = process.env.STORE_CODE || '001';
    const hqBaseUrl = this.getBaseHqInventoryUrl();
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    // 1. Intentar validación en línea contra Matriz (HQ) con timeout estricto de 1.5s
    if (hqBaseUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        try {
          const res = await fetch(`${hqBaseUrl}/${encodeURIComponent(storeCode)}/${encodeURIComponent(cleanCode)}`, {
            headers: { 'x-sync-key': syncKey },
            signal: controller.signal,
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            const stock = Number(data.stock ?? 0);
            const minStock = Number(data.minStock ?? 0);

            // Actualizar réplica local en segundo plano para contingencia
            if (this.prisma.inventarioTienda?.upsert) {
              await this.prisma.inventarioTienda.upsert({
                where: {
                  idTienda_codigoProducto: {
                    idTienda: storeCode,
                    codigoProducto: cleanCode,
                  },
                },
                update: { stock, minStock },
                create: {
                  idTienda: storeCode,
                  codigoProducto: cleanCode,
                  stock,
                  minStock,
                },
              }).catch((e: any) => {
                this.logger.debug(`Error al actualizar cache local de inventario: ${e.message}`);
              });
            }

            return {
              productCode: cleanCode,
              stock,
              minStock,
              isAvailable: stock > 0,
              source: 'HQ',
              updatedAt: data.updatedAt || new Date().toISOString(),
            };
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err: any) {
        this.logger.warn(`HQ inalcanzable para validación de stock (${err.message}). Activando contingencia local.`);
      }
    }

    // 2. Fallback contingencia: leer de la base de datos local
    let localStock = 0;
    let localMinStock = 0;
    let localUpdatedAt: string | null = null;

    if (this.prisma.inventarioTienda?.findUnique) {
      const local = await this.prisma.inventarioTienda.findUnique({
        where: {
          idTienda_codigoProducto: {
            idTienda: storeCode,
            codigoProducto: cleanCode,
          },
        },
      });
      if (local) {
        localStock = Number(local.stock);
        localMinStock = Number(local.minStock);
        localUpdatedAt = local.actualizadoEn ? local.actualizadoEn.toISOString() : null;
      }
    }

    return {
      productCode: cleanCode,
      stock: localStock,
      minStock: localMinStock,
      isAvailable: localStock > 0,
      source: 'LOCAL_OFFLINE',
      updatedAt: localUpdatedAt,
    };
  }

  async getNetworkStock(productCode: string): Promise<NetworkStockResult> {
    const cleanCode = (productCode || '').trim();
    const storeCode = process.env.STORE_CODE || '001';
    const storeName = process.env.STORE_NAME || `Sucursal ${storeCode}`;
    const hqBaseUrl = this.getBaseHqInventoryUrl();
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    if (hqBaseUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          const res = await fetch(`${hqBaseUrl}/network/${encodeURIComponent(cleanCode)}`, {
            headers: { 'x-sync-key': syncKey },
            signal: controller.signal,
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            return {
              productCode: cleanCode,
              items: data.items || [],
              totalNetworkStock: Number(data.totalNetworkStock ?? 0),
              source: 'HQ',
            };
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err: any) {
        this.logger.warn(`Error al consultar red de inventario en HQ: ${err.message}`);
      }
    }

    // Si HQ no está disponible, devolver al menos la sucursal local
    const local = await this.checkProductStock(cleanCode);
    return {
      productCode: cleanCode,
      items: [
        {
          storeCode,
          storeName,
          stock: local.stock,
          minStock: local.minStock,
          isAvailable: local.isAvailable,
          updatedAt: local.updatedAt,
        },
      ],
      totalNetworkStock: local.stock,
      source: 'LOCAL_OFFLINE',
    };
  }

  async decrementLocalStock(
    storeCode: string,
    items: Array<{ productCode: string; quantity: number }>,
    tx?: any,
  ): Promise<void> {
    const client = tx || this.prisma;
    if (!client.inventarioTienda?.upsert) return;

    for (const item of items) {
      if (!item.productCode || item.quantity <= 0) continue;
      try {
        await client.inventarioTienda.upsert({
          where: {
            idTienda_codigoProducto: {
              idTienda: storeCode,
              codigoProducto: item.productCode,
            },
          },
          update: {
            stock: { decrement: item.quantity },
          },
          create: {
            idTienda: storeCode,
            codigoProducto: item.productCode,
            stock: -item.quantity,
            minStock: 0,
          },
        });
      } catch (err: any) {
        this.logger.warn(`No se pudo descontar inventario local para ${item.productCode}: ${err.message}`);
      }
    }
  }
}

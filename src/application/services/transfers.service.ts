import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreTransferRequestDto } from '../../infrastructure/web/dto/transfer/create-store-transfer-request.dto';


@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(private readonly prisma: PrismaService) {}

  getBaseHqTransfersUrl(): string {
    const raw = (process.env.BACKOFFICE_SYNC_URL || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    const base = raw.replace(/\/sync$/, '');
    return `${base}/api/transfers`;
  }

  async requestTransfer(dto: CreateStoreTransferRequestDto) {
    const storeCode = process.env.STORE_CODE || '001';
    const toStoreCode = (dto.toStoreCode || storeCode).trim();
    const fromStoreCode = (dto.fromStoreCode || '').trim();
    const requestedBy = (dto.requestedBy || 'CAJERO').trim();
    const hqBaseUrl = this.getBaseHqTransfersUrl();
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    if (!fromStoreCode) {
      throw new HttpException(
        'Debe especificar la sucursal de origen para el traspaso',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (fromStoreCode === toStoreCode) {
      throw new HttpException(
        'La sucursal de origen y destino no pueden ser iguales',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new HttpException(
        'Debe incluir al menos un producto a traspasar',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!hqBaseUrl) {
      throw new HttpException(
        'HQ URL no configurada en el punto de venta',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch(hqBaseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-sync-key': syncKey,
          },
          body: JSON.stringify({
            fromStoreCode,
            toStoreCode,
            requestedBy,
            notes: dto.notes ?? null,
            items: dto.items,
          }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new HttpException(
            data.message || 'Error al procesar solicitud en HQ',
            res.status || HttpStatus.BAD_REQUEST,
          );
        }

        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Error de red al conectar con HQ para solicitar traspaso: ${err.message}`);
      throw new HttpException(
        `No fue posible conectar con Matriz para registrar el traspaso (${err.message})`,
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }
  }

  async getMyStoreTransfers() {
    const storeCode = process.env.STORE_CODE || '001';
    const hqBaseUrl = this.getBaseHqTransfersUrl();
    const syncKey = process.env.BACKOFFICE_SYNC_KEY || 'prisma-cloud-sync-key';

    if (!hqBaseUrl) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch(`${hqBaseUrl}?storeCode=${encodeURIComponent(storeCode)}`, {
          headers: { 'x-sync-key': syncKey },
          signal: controller.signal,
        });

        if (res.ok) {
          return await res.json();
        }
        return [];
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      this.logger.warn(`No se pudieron obtener traspasos de HQ: ${err.message}`);
      return [];
    }
  }
}

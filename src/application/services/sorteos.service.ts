import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SorteosRepository } from '../../domain/ports/out/sorteos-repository.interface';

export interface SorteoTicket {
  sorteoId: number;
  nombre: string;
  textoTicket: string;
  correlativo: string;
}

@Injectable()
export class SorteosService {
  private readonly logger = new Logger(SorteosService.name);

  constructor(
    @Inject('SorteosRepository')
    private readonly sorteosRepo: SorteosRepository,
  ) {}

  async evaluateSorteos(params: {
    storeId: string;
    posNo: string;
    posTransactionId: string;
    total: number;
    items: Array<{ code: string; discount: number; total: number }>;
    isCredit: boolean;
    payments: Array<{ method: string; code: string; amount: number }>;
    customerNo: string;
  }): Promise<SorteoTicket[]> {
    const {
      storeId,
      posNo,
      posTransactionId,
      total,
      items,
      isCredit,
      payments,
    } = params;
    this.logger.log(
      `Evaluating Sorteos for POS Transaction ID: ${posTransactionId}`,
    );

    const ticketsWon: SorteoTicket[] = [];

    try {
      const activeSorteos = await this.sorteosRepo.getActiveSorteos();
      if (!activeSorteos || activeSorteos.length === 0) {
        this.logger.log('No active sorteos found.');
        return ticketsWon;
      }

      this.logger.log(`Found ${activeSorteos.length} active sorteo(s).`);

      const fuelCodes = await this.sorteosRepo.getFuelCodes();

      const itemCodes = items.map((it) => it.code);
      const itemCategoryRows =
        await this.sorteosRepo.getItemCategories(itemCodes);
      const itemCategoryMap: Record<string, string> = {};
      for (const row of itemCategoryRows || []) {
        itemCategoryMap[(row.No_ || '').trim().toUpperCase()] = (
          row['Item Category Code'] || ''
        )
          .trim()
          .toUpperCase();
      }

      for (const sorteo of activeSorteos) {
        const sorteoId = sorteo.SorteoID;
        const nombre = sorteo.Nombre;
        const textoTicket = sorteo.TextoTicket || '';

        this.logger.log(`Evaluating Sorteo: ${nombre} (ID: ${sorteoId})`);

        const conditions = await this.sorteosRepo.getSorteoConditions(sorteoId);
        let meetsAll = true;

        if (conditions && conditions.length > 0) {
          for (const cond of conditions) {
            const tipo = (cond.TipoEvaluacion || '').trim().toUpperCase();
            const valTexto = (cond.ValorTexto || cond.ValorRequerido || '')
              .trim()
              .toUpperCase();
            const valMonto = cond.ValorMonto
              ? parseFloat(cond.ValorMonto as unknown as string)
              : 0;
            let conditionMet = false;

            if (tipo === 'MONTOFACTURA' || tipo === 'MONTO_MINIMO') {
              const minAmount =
                valMonto > 0
                  ? valMonto
                  : parseFloat(cond.ValorRequerido || '0') || 0;
              conditionMet = total >= minAmount;
            } else if (tipo === 'CATEGORIA') {
              if (valTexto === 'COMBUSTIBLES') {
                conditionMet = items.some((it) =>
                  fuelCodes.includes(it.code.trim().toUpperCase()),
                );
              } else {
                conditionMet = items.some((it) => {
                  const itemCat =
                    itemCategoryMap[it.code.trim().toUpperCase()] || '';
                  return itemCat === valTexto;
                });
              }
            } else if (tipo === 'TIPO_CLIENTE') {
              conditionMet = valTexto === (isCredit ? 'CREDITO' : 'CONTADO');
            } else if (tipo === 'SIN_DESCUENTO') {
              conditionMet = !items.some((it) => it.discount > 0);
            } else if (tipo === 'SIN_ACUMULAR_PUNTOS') {
              conditionMet = !payments.some(
                (p) =>
                  p.method.toUpperCase().includes('LEAL') ||
                  p.code.toUpperCase().includes('LEAL'),
              );
            } else {
              conditionMet = true;
            }

            if (!conditionMet) {
              meetsAll = false;
              break;
            }
          }
        }

        if (meetsAll) {
          const correlativo = this.generateCorrelativo(
            storeId,
            posNo,
            sorteoId,
            posTransactionId,
          );
          this.logger.log(`Sorteo ${nombre} WON! Correlativo: ${correlativo}`);
          await this.sorteosRepo.saveWonSorteo(
            posTransactionId,
            correlativo,
            sorteoId,
          );

          ticketsWon.push({ sorteoId, nombre, textoTicket, correlativo });
        }
      }
    } catch (err) {
      this.logger.error('Error during Sorteos evaluation:', err);
    }

    return ticketsWon;
  }

  private generateCorrelativo(
    storeId: string,
    posNo: string,
    sorteoId: number,
    posTransactionId: string,
  ): string {
    const cleanStoreId = storeId.trim();
    let numericStoreId = parseInt(cleanStoreId, 10);
    if (isNaN(numericStoreId)) numericStoreId = 1;
    const strTienda = numericStoreId.toString().padStart(3, '0');
    const strPos = posNo.trim().padStart(2, '0');
    const strSorteo = sorteoId.toString();
    const digitsOnly = posTransactionId.replace(/\D/g, '');
    const num = parseInt(digitsOnly, 10);
    const base36 = !isNaN(num)
      ? this.convertToBase36(num)
      : Math.random().toString(36).substring(2, 9).toUpperCase();
    return `${strTienda}${strPos}${strSorteo}-${base36}`;
  }

  private convertToBase36(value: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (value === 0) return '0';
    let result = '';
    let val = value;
    while (val > 0) {
      result = chars[val % 36] + result;
      val = Math.floor(val / 36);
    }
    return result;
  }
}

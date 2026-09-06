import { Injectable, Inject, Logger } from '@nestjs/common';
import type {
  CampanasRepository,
  CondicionCampanaRow,
} from '../../domain/ports/out/campanas-repository.interface';

export interface CampanaTicket {
  campanaId: number;
  nombre: string;
  textoTicket: string;
  correlativo: string;
}

type Operador = 'GTE' | 'LTE' | 'EQ' | 'NEQ' | 'IN' | 'CONTAINS';

const OPERADORES: ReadonlySet<string> = new Set([
  'GTE',
  'LTE',
  'EQ',
  'NEQ',
  'IN',
  'CONTAINS',
]);

const TIPOS: ReadonlySet<string> = new Set([
  'TOTAL_FACTURA',
  'CANTIDAD_ITEM',
  'CATEGORIA',
  'TIPO_CLIENTE',
  'SIN_DESCUENTO',
  'SIN_ACUMULAR_PUNTOS',
]);

interface EvalCtx {
  total: number;
  items: Array<{ code: string; quantity: number }>;
  itemCategoryMap: Record<string, string>;
  isCredit: boolean;
  hasDiscount: boolean;
  paysWithLeal: boolean;
}

@Injectable()
export class CampanasService {
  private readonly logger = new Logger(CampanasService.name);

  constructor(
    @Inject('CampanasRepository')
    private readonly campanasRepo: CampanasRepository,
  ) {}

  async evaluateCampanas(
    params: {
      storeId: string;
      posNo: string;
      posTransactionId: string;
      total: number;
      items: Array<{
        code: string;
        discount: number;
        total: number;
        quantity: number;
      }>;
      isCredit: boolean;
      payments: Array<{ method: string; code: string; amount: number }>;
      customerNo: string;
    },
    tx?: any,
  ): Promise<CampanaTicket[]> {
    const {
      storeId,
      posNo,
      posTransactionId,
      total,
      items,
      isCredit,
      payments,
      customerNo,
    } = params;
    const ticketsWon: CampanaTicket[] = [];

    try {
      const activeCampanas = await this.campanasRepo.getActiveCampanas(tx);
      if (!activeCampanas || activeCampanas.length === 0) {
        this.logger.log('No active campanas found.');
        return ticketsWon;
      }

      const itemCodes = items.map((it) => it.code);
      const itemCategoryRows =
        await this.campanasRepo.getItemCategories(itemCodes, tx);
      const itemCategoryMap: Record<string, string> = {};
      for (const row of itemCategoryRows || []) {
        itemCategoryMap[(row.No_ || '').trim().toUpperCase()] = (
          row['Item Category Code'] || ''
        )
          .trim()
          .toUpperCase();
      }

      const ctx: EvalCtx = {
        total,
        items: items.map((it) => ({ code: it.code, quantity: it.quantity })),
        itemCategoryMap,
        isCredit,
        hasDiscount: items.some((it) => it.discount > 0),
        paysWithLeal: payments.some(
          (p) =>
            p.method.toUpperCase().includes('LEAL') ||
            p.code.toUpperCase().includes('LEAL'),
        ),
      };

      for (const campana of activeCampanas) {
        const conditions = await this.campanasRepo.getCampanaConditions(
          campana.CampanaID,
          tx,
        );

        let meets: boolean;
        if (conditions.length === 0) {
          meets = true;
        } else {
          const results = conditions.map((cond) =>
            this.evaluateCondition(cond, ctx),
          );
          meets =
            campana.ModoEvaluacion === 'ANY'
              ? results.some(Boolean)
              : results.every(Boolean);
        }
        if (!meets) continue;

        if (campana.LimitePorCliente != null) {
          if (!customerNo) continue;
          const count = await this.campanasRepo.countParticipaciones(
            campana.CampanaID,
            customerNo,
            tx,
          );
          if (count >= campana.LimitePorCliente) continue;
        }

        const correlativo = this.generateCorrelativo(
          storeId,
          posNo,
          campana.CampanaID,
          posTransactionId,
        );
        this.logger.log(
          `Campana ${campana.Nombre} won. Correlativo: ${correlativo}`,
        );
        await this.campanasRepo.saveParticipacion(
          {
            posTransactionId,
            correlativo,
            campanaId: campana.CampanaID,
            codigoCliente: customerNo || null,
          },
          tx,
        );
        ticketsWon.push({
          campanaId: campana.CampanaID,
          nombre: campana.Nombre,
          textoTicket: campana.TextoTicket || '',
          correlativo,
        });
      }
    } catch (err) {
      this.logger.error('Error during Campanas evaluation:', err);
    }

    return ticketsWon;
  }

  private evaluateCondition(cond: CondicionCampanaRow, ctx: EvalCtx): boolean {
    const tipo = cond.TipoEvaluacion.trim().toUpperCase();
    const op = cond.Operador.trim().toUpperCase();

    if (!TIPOS.has(tipo)) {
      this.logger.warn(`TipoEvaluacion desconocido: ${tipo}`);
      return false;
    }
    if (!OPERADORES.has(op)) {
      this.logger.warn(`Operador desconocido: ${op}`);
      return false;
    }

    switch (tipo) {
      case 'TOTAL_FACTURA':
        return this.compareNum(ctx.total, cond.ValorMonto, op);
      case 'CANTIDAD_ITEM': {
        const maxQty = Math.max(0, ...ctx.items.map((i) => i.quantity || 0));
        return this.compareNum(maxQty, cond.ValorCantidad, op);
      }
      case 'CATEGORIA': {
        const target = cond.ValorTexto.trim().toUpperCase();
        const cats = ctx.items
          .map((it) => ctx.itemCategoryMap[it.code.trim().toUpperCase()] || '')
          .filter(Boolean);
        return this.compareList(cats, target, op);
      }
      case 'TIPO_CLIENTE': {
        const actual = ctx.isCredit ? 'CREDITO' : 'CONTADO';
        return this.compareTexto(actual, cond.ValorTexto, op);
      }
      case 'SIN_DESCUENTO':
        return this.compareTexto(
          ctx.hasDiscount ? 'TRUE' : 'FALSE',
          cond.ValorTexto || 'FALSE',
          op,
        );
      case 'SIN_ACUMULAR_PUNTOS':
        return this.compareTexto(
          ctx.paysWithLeal ? 'TRUE' : 'FALSE',
          cond.ValorTexto || 'FALSE',
          op,
        );
      default:
        return false;
    }
  }

  private compareNum(actual: number, threshold: number, op: string): boolean {
    switch (op) {
      case 'GTE':
        return actual >= threshold;
      case 'LTE':
        return actual <= threshold;
      case 'EQ':
        return actual === threshold;
      case 'NEQ':
        return actual !== threshold;
      default:
        return false;
    }
  }

  private compareTexto(actual: string, expected: string, op: string): boolean {
    const a = actual.toUpperCase();
    const e = expected.trim().toUpperCase();
    switch (op) {
      case 'EQ':
        return a === e;
      case 'NEQ':
        return a !== e;
      case 'CONTAINS':
        return a.includes(e);
      case 'IN':
        return e
          .split(',')
          .map((s) => s.trim())
          .includes(a);
      default:
        return false;
    }
  }

  private compareList(values: string[], target: string, op: string): boolean {
    switch (op) {
      case 'EQ':
        return values.some((v) => v === target);
      case 'NEQ':
        return values.every((v) => v !== target);
      case 'CONTAINS':
        return values.some((v) => v.includes(target));
      case 'IN':
        return values.some((v) =>
          target
            .split(',')
            .map((s) => s.trim())
            .includes(v),
        );
      default:
        return false;
    }
  }

  private generateCorrelativo(
    storeId: string,
    posNo: string,
    campanaId: number,
    posTransactionId: string,
  ): string {
    const cleanStoreId = storeId.trim();
    let numericStoreId = parseInt(cleanStoreId, 10);
    if (isNaN(numericStoreId)) numericStoreId = 1;
    const strTienda = numericStoreId.toString().padStart(3, '0');
    const strPos = posNo.trim().padStart(2, '0');
    const strCampana = campanaId.toString();
    const digitsOnly = posTransactionId.replace(/\D/g, '');
    const num = parseInt(digitsOnly, 10);
    const base36 = !isNaN(num)
      ? this.convertToBase36(num)
      : Math.random().toString(36).substring(2, 9).toUpperCase();
    return `${strTienda}${strPos}${strCampana}-${base36}`;
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
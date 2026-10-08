import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import type { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import type { StoreConfigRepository } from '../../../domain/ports/out/store-config-repository.interface';

export interface CheckCustomerCreditResult {
  customerNo: string;
  customerName: string;
  creditLimit: number;
  balance: number;
  disponible: number;
  isAllowed: boolean;
  reason?: string;
  source: 'ONLINE' | 'OFFLINE_FALLBACK';
  evaluatedAmount: number;
}

@Injectable()
export class CheckCustomerCreditUseCase {
  private readonly logger = new Logger(CheckCustomerCreditUseCase.name);

  constructor(
    @Inject('CustomerRepository')
    private readonly customerRepository: CustomerRepository,
    @Inject('StoreConfigRepository')
    private readonly storeConfigRepository: StoreConfigRepository,
  ) {}

  async execute(
    code: string,
    amount?: number,
    storeId?: string,
  ): Promise<CheckCustomerCreditResult> {
    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      throw new NotFoundException('Código de cliente no proporcionado.');
    }

    const reqAmount =
      amount != null && !isNaN(Number(amount)) && Number(amount) > 0
        ? Number(amount)
        : 0;
    const timeoutMs =
      await this.storeConfigRepository.findCreditCheckTimeoutMs(storeId);
    const syncUrl = process.env.CLOUD_SYNC_URL || 'http://localhost:3089/sync';
    const syncKey = process.env.SYNC_API_KEY || 'prisma-cloud-sync-key';

    let source: 'ONLINE' | 'OFFLINE_FALLBACK' = 'ONLINE';
    let customerData: {
      code: string;
      name: string;
      balance: number;
      creditLimit: number;
      blocked: boolean;
      blockOnOverdue: boolean;
      hasOverdueInvoices: boolean;
    } | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `${syncUrl.replace(/\/+$/, '')}/customers/${encodeURIComponent(cleanCode)}/live-balance`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'x-sync-key': syncKey },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const central = await res.json();
        customerData = {
          code: String(central.customerNo || cleanCode).trim(),
          name: String(central.customerName || cleanCode).trim(),
          balance: Number(central.balance || 0),
          creditLimit: Number(central.creditLimit || 0),
          blocked: central.blocked === true,
          blockOnOverdue: central.blockOnOverdue !== false,
          hasOverdueInvoices: central.hasOverdueInvoices === true,
        };
        if (this.customerRepository.refreshCustomerData) {
          await this.customerRepository.refreshCustomerData(cleanCode, {
            balance: customerData.balance,
            creditLimit: customerData.creditLimit,
            blocked: customerData.blocked,
          });
        }
      } else {
        source = 'OFFLINE_FALLBACK';
      }
    } catch {
      source = 'OFFLINE_FALLBACK';
    }

    if (source === 'OFFLINE_FALLBACK' || !customerData) {
      const local = await this.customerRepository.findByCode(cleanCode);
      if (!local) {
        throw new NotFoundException(
          `Cliente con código '${cleanCode}' no encontrado.`,
        );
      }
      customerData = {
        code: local.code,
        name: local.name,
        balance: Number(local.balance || 0),
        creditLimit: Number(local.creditLimit || 0),
        blocked: local.blocked === true,
        blockOnOverdue: local.blockOnOverdue !== false,
        hasOverdueInvoices: local.hasOverdueInvoices === true,
      };
    }

    const disponible = Math.max(
      0,
      Math.round((customerData.creditLimit - customerData.balance) * 100) / 100,
    );
    let isAllowed = true;
    let reason = '';

    if (customerData.blocked) {
      isAllowed = false;
      reason = 'Cliente bloqueado administrativamente';
    } else if (customerData.blockOnOverdue && customerData.hasOverdueInvoices) {
      isAllowed = false;
      reason = 'Cliente en mora con facturas vencidas';
    } else if (customerData.creditLimit <= 0) {
      isAllowed = false;
      reason = 'El cliente no tiene un límite de crédito configurado';
    } else if (reqAmount > 0 && reqAmount > disponible) {
      const exceso = reqAmount - disponible;
      isAllowed = false;
      reason = `El monto solicitado (L. ${reqAmount.toFixed(2)}) excede el saldo disponible (L. ${disponible.toFixed(2)}). Excede por L. ${exceso.toFixed(2)}.`;
    }

    return {
      customerNo: customerData.code,
      customerName: customerData.name,
      creditLimit: customerData.creditLimit,
      balance: customerData.balance,
      disponible,
      isAllowed,
      reason: reason || undefined,
      source,
      evaluatedAmount: reqAmount,
    };
  }
}

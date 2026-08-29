import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  PaymentRepository,
  ProcessPaymentRequest,
  PaymentProcessResult,
} from '../../../domain/ports/out/payment-repository.interface';
import type { InvoiceRepository } from '../../../domain/ports/out/invoice-repository.interface';
import { PaymentMethod } from '../../../domain/entities/payment-method.entity';

@Injectable()
export class PaymentRepositoryImpl implements PaymentRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('InvoiceRepository')
    private readonly invoiceRepository: InvoiceRepository,
  ) {}

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const rows = await this.prisma.metodoPago.findMany({
        where: { activo: true },
        orderBy: { codigo: 'asc' },
      });
      return rows.map((r) => ({
        code: r.codigo,
        description: (r.descripcion || '').trim(),
        categoria: r.categoria,
        facturaContado: r.facturaContado,
        facturaCredito: r.facturaCredito,
        salidaCombustible: r.salidaCombustible,
        fidelizacion: r.fidelizacion,
        requiereReferencia: r.requiereReferencia,
        imagen: r.imagen ? `/images/${r.imagen}` : null,
        activo: r.activo,
      }));
    } catch {
      return [];
    }
  }

  async processPayment(
    data: ProcessPaymentRequest,
  ): Promise<PaymentProcessResult> {
    const itemShape = (data.items ?? []) as Array<{
      code?: string;
      description?: string;
      qty?: number;
      price?: number;
      tax?: number;
      discount?: number;
      total?: number;
      saleId?: number;
    }>;

    const lines = itemShape.map((item, index) => ({
      lineNo: index + 1,
      itemCode: item.code ?? '',
      description: item.description ?? '',
      quantity: item.qty ?? 0,
      unitPrice: item.price ?? 0,
      discount: item.discount ?? 0,
      discountPercentage: 0,
      vatPercent: 0,
      vatAmount: item.tax ?? 0,
      amountIncludingVAT: item.total ?? 0,
      pumpNo: '',
      pumpPositionNo: '',
      tankNo: '',
      itemCategoryCode: '',
      genPumpLedgEntry: 0,
      vatProdPostingGroup: '',
      saleId: item.saleId ?? null,
    }));

    const payments = (data.payments ?? []).map((payment, index) => ({
      chargeLineNo: index + 1,
      code: payment.code,
      amount: payment.amount,
      reference: payment.reference ?? '',
      description: payment.description,
    }));

    const rows = await this.invoiceRepository.executeInvoiceInsert({
      storeId: data.storeId,
      posNo: data.posNo,
      employeeName: '',
      shiftDate: new Date(),
      shiftNumber: data.shiftNumber,
      customerNo: data.customerNo,
      customerName: data.customerName,
      customerRtn: data.customerRtn ?? '',
      total: data.total,
      tax: data.tax,
      discount: data.discount,
      isTicket: false,
      isCredit: false,
      comment: '',
      km: '',
      orden: '',
      placa: '',
      chofer: '',
      lines,
      payments,
    });

    return {
      success: true,
      invoiceNo: rows[0]?.NextInvoiceOfNextInvoice ?? '',
    };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import {
  CreateInvoiceInput,
  CreditNoteInput,
} from '../../domain/entities/invoice.entity';
import { DispensersService } from './dispensers.service';
import { SorteosService, SorteoTicket } from './sorteos.service';
import { Mutex } from '../../utils/mutex';
import { InvoiceLealProcessor } from './invoice-leal.processor';
import type {
  InvoiceRepository,
  InvoiceLineItem,
  InvoicePaymentItem,
  InvoiceLineRow,
  PaymentMethodRow,
  OriginalDocumentRow,
  InvoiceInsertResultRow,
} from '../../domain/ports/out/invoice-repository.interface';
import type { DispenserRepository } from '../../domain/ports/out/dispenser-repository.interface';
import type { StoreConfigRepository } from '../../domain/ports/out/store-config-repository.interface';

const createInvoiceMutex = new Mutex();

interface CreditNoteUser {
  storeId: string;
  posNo: string;
  username?: string;
  name?: string;
}

interface ExtractedInvoiceResult {
  invoiceNo: string;
  posTransactionId: string | null;
  cai: string | null;
  startingNo: string | null;
  endingNo: string | null;
  fechaVence: string | null;
}

@Injectable()
export class InvoicesService {
  constructor(
    @Inject('InvoiceRepository')
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('DispenserRepository')
    private readonly dispenserRepo: DispenserRepository,
    @Inject('StoreConfigRepository')
    private readonly storeConfigRepo: StoreConfigRepository,
    private readonly dispensersService: DispensersService,
    private readonly sorteosService: SorteosService,
    private readonly lealProcessor: InvoiceLealProcessor,
  ) {}

  async createInvoice(dto: CreateInvoiceInput) {
    const unlock = await createInvoiceMutex.lock();
    try {
      return await this._createInvoiceInternal(dto);
    } finally {
      unlock();
    }
  }

  private async _createInvoiceInternal(dto: CreateInvoiceInput) {
    const { shiftDate: dbShiftDate, employeeName: dbEmployeeName } =
      await this.invoiceRepo.getShiftDetails(
        dto.storeId,
        dto.posNo,
        dto.shiftNumber.toString(),
        dto.employeeName,
      );
    // Ignore client provided shiftDate to prevent timezone drift, always use the DB shift date
    const shiftDate = dbShiftDate;
    const employeeName = dto.employeeName || dbEmployeeName;

    const lines = await this.buildInvoiceLines(dto);
    const payments = this.buildInvoicePayments(dto);

    const { invoiceNo: predictedInvoiceNo } =
      await this.invoiceRepo.findNextCorrelative(dto.storeId, dto.posNo);

    // 1. Procesar Leal ANTES de insertar la factura (para validar OTP y evitar facturas huérfanas)
    const { redemptions: lealRedemptionResults, message: redemptionMessage } =
      await this.lealProcessor.processRedemptions(dto, predictedInvoiceNo);
    const { result: lealAccumulationResult, message: accumulationMessage } =
      await this.lealProcessor.processAccumulation(dto, predictedInvoiceNo);
    const lealReprintMessage = redemptionMessage + accumulationMessage;

    // 2. Insertar factura en DB (solo si Leal se procesó correctamente)
    const executeResult = await this.invoiceRepo.executeInvoiceInsert({
      storeId: dto.storeId,
      posNo: dto.posNo,
      employeeName,
      shiftDate,
      shiftNumber: dto.shiftNumber.toString(),
      customerNo: dto.customerNo,
      customerName: dto.customerName,
      customerRtn: dto.customerRtn || '',
      total: dto.total,
      tax: dto.tax,
      discount: dto.discount,
      isTicket: !!dto.isTicket,
      isCredit: !!dto.isCredit,
      comment: dto.comment || '',
      km: dto.km || '',
      orden: dto.orden || '',
      placa: dto.placa || '',
      chofer: dto.chofer || '',
      lines,
      payments,
    });

    const extracted = this.extractInvoiceResult(executeResult, dto);

    // 3. Insertar transacciones Leal en DB (ahora con posTransactionId real)
    if (extracted.posTransactionId) {
      await this.lealProcessor.persistTransactions(
        dto,
        extracted.posTransactionId,
        lealRedemptionResults,
        lealAccumulationResult,
      );
    }

    await this.clearPumpSales(dto);

    const sorteoTickets = extracted.posTransactionId
      ? await this.evaluateSorteos(dto, extracted.posTransactionId)
      : [];

    return {
      success: true,
      invoiceNo: extracted.invoiceNo,
      posTransactionId: extracted.posTransactionId,
      cai: extracted.cai,
      startingNo: extracted.startingNo,
      endingNo: extracted.endingNo,
      fechaVence: extracted.fechaVence,
      createdAt: new Date().toISOString(),
      sorteoTickets,
      lealReprintMessage,
    };
  }

  async validateCorrelative(storeId: string, posNo: string, isTicket: boolean) {
    return this.invoiceRepo.validateCorrelative(storeId, posNo, isTicket);
  }

  async searchInvoices(
    storeId: string,
    avanzado: boolean,
    posNo?: string,
    turno?: string,
    fechaTurno?: string,
    fechaDesde?: string,
    fechaHasta?: string,
    factura?: string,
    customerName?: string,
    employeeName?: string,
    page?: number,
    pageSize?: number,
  ) {
    return this.invoiceRepo.searchInvoices({
      storeId,
      avanzado,
      posNo,
      turno,
      fechaTurno,
      fechaDesde,
      fechaHasta,
      factura,
      customerName,
      employeeName,
      page,
      pageSize,
    });
  }

  async getInvoiceLines(transactionId: string) {
    return this.invoiceRepo.getInvoiceLines(transactionId);
  }

  async getInvoicePayments(transactionId: string) {
    return this.invoiceRepo.getInvoicePayments(transactionId);
  }

  async getInvoiceLealMessage(
    transactionId: string,
  ): Promise<{ lealReprintMessage: string }> {
    try {
      const rows =
        await this.invoiceRepo.getInvoiceLealTransactions(transactionId);
      if (!rows || rows.length === 0) return { lealReprintMessage: '' };
      let msg = '';
      for (const row of rows) {
        msg +=
          row.Tipo === 1
            ? `Puntos Redimidos: ${row.Puntos} | Puntos Activos: ${row.PuntosActivos}\n`
            : `Puntos Acumulados: ${row.Puntos} | Puntos Activos: ${row.PuntosActivos}\n`;
      }
      return { lealReprintMessage: msg };
    } catch {
      return { lealReprintMessage: '' };
    }
  }

  async getInvoiceSorteos(transactionId: string): Promise<any[]> {
    return this.invoiceRepo.getInvoiceSorteos(transactionId);
  }

  async getReasons(): Promise<any[]> {
    return this.invoiceRepo.getReasons();
  }

  async processCreditNote(dto: CreditNoteInput, user: CreditNoteUser) {
    const shiftData = await this.invoiceRepo.getOpenShiftForEmployee(
      user.storeId,
      user.name || user.username || '',
    );
    if (!shiftData) {
      throw new Error(
        'No tiene un turno abierto para este usuario. Por favor, abra un turno.',
      );
    }

    const headerRow = (await this.invoiceRepo.getOriginalDocument(
      dto.invoiceNo,
      dto.transactionId,
    )) as OriginalDocumentRow | null;
    if (!headerRow) {
      throw new Error(
        `No se encontró el documento original ${dto.invoiceNo} en la base de datos.`,
      );
    }

    const docTypeStr = headerRow['POS Sales Doc_ Type']?.toString();
    if (docTypeStr?.trim() !== '1' && docTypeStr?.trim() !== '2') {
      throw new Error(
        'No se puede anular este documento. Solo se puede hacer devolucion de facturas.',
      );
    }

    const hasReversion = await this.invoiceRepo.checkExistingReversion(
      dto.invoiceNo,
      dto.transactionId,
    );
    if (hasReversion) {
      throw new Error(
        `La factura ${dto.invoiceNo} ya tiene una Nota de Crédito generada.`,
      );
    }

    await this.invoiceRepo.findNextCreditNoteCorrelative(
      user.storeId,
      user.posNo,
    );

    let isLealActive = false;
    try {
      const conf = await this.storeConfigRepo.findByStoreId(user.storeId);
      isLealActive = conf?.isLealEnabled || false;
    } catch {
      /* ignorar si no existe configuración */
    }

    if (isLealActive) {
      await this.lealProcessor.reverseForCreditNote(dto.transactionId);
    }

    const { nextPosTransactionId, finalInvoiceNo } =
      await this.invoiceRepo.executeCreditNote({
        storeId: user.storeId,
        posNo: user.posNo,
        employeeName: user.name || user.username || '',
        shiftStarting: shiftData['Shift Starting'],
        shiftNumber: shiftData['Shift']?.toString() || '',
        customerNo: headerRow['Customer No_'] || '',
        customerName: headerRow['Cust_ Name'] || '',
        customerRtn: headerRow['VAT Reg_ No_'] || '',
        amount: (headerRow['Amount'] || 0) * -1,
        subTotal: (headerRow['SubTotal'] || 0) * -1,
        billingType: headerRow['Billing Type']?.toString() || '',
        invoiceNo: dto.invoiceNo,
        transactionId: dto.transactionId,
        reason: dto.reason,
        km: headerRow['KM'] || '',
        orden: headerRow['Orden'] || '',
        placa: headerRow['Placa'] || '',
        chofer: headerRow['Chofer'] || '',
        cambio: headerRow['Cambio'] || 0,
      });

    const getLines = (await this.invoiceRepo.getInvoiceLines(
      dto.transactionId,
    )) as InvoiceLineRow[];
    let lineNumber = 0;
    for (const row of getLines) {
      lineNumber += 10;
      await this.invoiceRepo.insertSalesLine({
        nextPosTransactionId,
        storeId: user.storeId,
        posNo: user.posNo,
        finalInvoiceNo,
        lineNumber,
        row,
        sourceTransactionId: dto.transactionId,
        sourceInvoiceNo: dto.invoiceNo,
      });

      if (row.SaleID) {
        await this.dispenserRepo.reverseFusionSale(row.SaleID.toString());
      }
    }

    const getCharges = (await this.invoiceRepo.getInvoicePayments(
      dto.transactionId,
    )) as PaymentMethodRow[];
    let chargeLineNo = 0;
    for (const row of getCharges) {
      chargeLineNo += 10;
      await this.invoiceRepo.insertPaymentMethod({
        nextPosTransactionId,
        storeId: user.storeId,
        posNo: user.posNo,
        chargeLineNo,
        row,
      });
    }

    return {
      success: true,
      message: 'Devolución Exitosa',
      creditNoteNo: finalInvoiceNo,
    };
  }

  async renewTransactions() {
    const rowsAffected = await this.dispenserRepo.renewTransactions();
    return { success: true, rowsAffected };
  }

  async getInvoices(): Promise<any[]> {
    return this.invoiceRepo.findAll();
  }

  private async buildInvoiceLines(
    dto: CreateInvoiceInput,
  ): Promise<InvoiceLineItem[]> {
    const lines: InvoiceLineItem[] = [];
    let lineNo = 10;

    for (const item of dto.items) {
      let itemCode = item.code;
      let description = item.description;
      let quantity = item.qty;
      let unitPrice = item.price;
      let amountIncludingVAT = item.total;
      let pumpNo = '';
      let pumpPositionNo = '';
      let tankNo = '';
      let itemCategoryCode = '';
      let genPumpLedgEntry = 0;
      let vatProdPostingGroup = '';
      let saleIdVal = '';

      if (item.saleId) {
        const sale = await this.dispenserRepo.getSaleById(item.saleId);
        if (!sale) {
          throw new Error(
            `No se encontró la transacción de combustible #${item.saleId} en FusionController.`,
          );
        }
        if (sale.IsInvoiced) {
          throw new Error(
            `La transacción de combustible #${item.saleId} ya fue facturada anteriormente.`,
          );
        }
        pumpNo = sale.PumpNumber.toString();
        const hoseNum = parseInt(sale.HoseNumber.toString(), 10);
        if (!isNaN(hoseNum) && hoseNum > 0 && hoseNum <= 26) {
          pumpPositionNo = String.fromCharCode(64 + hoseNum);
        } else {
          pumpPositionNo = sale.HoseNumber.toString();
        }
        quantity = sale.volume;
        unitPrice = sale.ppu;
        amountIncludingVAT = item.total ?? sale.amount - (item.discount || 0);
        saleIdVal = item.saleId.toString();
        genPumpLedgEntry = 1;

        const hoseFs = await this.dispenserRepo.getHoseFsMapping(
          sale.PumpNumber,
          parseInt(sale.HoseNumber, 10),
        );
        if (hoseFs) {
          itemCode = hoseFs.CodigoPOS || 'SUPER';
          tankNo = (hoseFs.TankIDs || '').toString();
        }
      }

      const meta = await this.dispenserRepo.getItemMetadata(itemCode);
      if (meta) {
        description = meta.Description || description;
        vatProdPostingGroup = meta['VAT Prod_ Posting Group'] || '';
        itemCategoryCode = meta['Item Category Code'] || '';
        if (!item.saleId) {
          genPumpLedgEntry = meta['Gen_ Pump Ledg_ Entry'] || 0;
        }
      }

      const cleanGroup = vatProdPostingGroup.toUpperCase();
      let vatPercent = 0.0;
      if (cleanGroup === 'ISV_15') vatPercent = 15.0;
      else if (cleanGroup === 'ISV_18') vatPercent = 18.0;

      const vatAmount =
        amountIncludingVAT - amountIncludingVAT / (1 + vatPercent / 100);

      lines.push({
        lineNo,
        itemCode,
        description,
        quantity,
        unitPrice,
        discountPercentage: item.discountPercentage || 0,
        discount: item.discount,
        vatPercent,
        vatAmount,
        amountIncludingVAT,
        pumpNo,
        pumpPositionNo,
        tankNo,
        itemCategoryCode,
        genPumpLedgEntry,
        vatProdPostingGroup,
        saleId: saleIdVal,
      });
      lineNo += 10;
    }

    return lines;
  }

  private buildInvoicePayments(dto: CreateInvoiceInput): InvoicePaymentItem[] {
    const payments: InvoicePaymentItem[] = [];
    let chargeLineNo = 10;

    for (const payment of dto.payments) {
      let desc = 'EFECTIVO';
      const upper = payment.method.toUpperCase();
      if (
        upper.includes('TARJETA') ||
        upper.includes('BAC') ||
        upper.includes('BANPRO')
      )
        desc = 'TARJETA';
      else if (upper.includes('LEAL')) desc = 'LEAL';
      else if (
        upper.includes('CREDITO') ||
        upper.includes('CRÉDITO') ||
        upper.includes('CRED')
      )
        desc = 'CREDITO';

      const paymentRef =
        desc === 'LEAL' ? '' : (payment.reference || '').substring(0, 20);
      payments.push({
        chargeLineNo,
        code: payment.code,
        amount: payment.amount,
        reference: paymentRef,
        description: desc,
      });
      chargeLineNo += 10;
    }

    return payments;
  }

  private extractInvoiceResult(
    executeResult: InvoiceInsertResultRow[],
    dto: CreateInvoiceInput,
  ): ExtractedInvoiceResult {
    const fallbackInvoiceNo = `FAC-${dto.storeId}-${dto.posNo}-${Date.now().toString().slice(-6)}`;
    const result: ExtractedInvoiceResult = {
      invoiceNo: fallbackInvoiceNo,
      posTransactionId: null,
      cai: null,
      startingNo: null,
      endingNo: null,
      fechaVence: null,
    };

    if (!executeResult || executeResult.length === 0) {
      return result;
    }

    const getSingle = (
      val: string | Date | null | undefined,
    ): string | null => {
      if (val === null || val === undefined) return null;
      if (Array.isArray(val))
        return val.length === 0
          ? null
          : getSingle(val[0] as string | Date | null | undefined);
      return String(val);
    };
    const flat = executeResult.flat(Infinity);
    const row = flat.find(
      (r) =>
        r &&
        (r.NextInvoiceOfNextInvoice ||
          r.NextPosTransactionIDNumber ||
          r.CAIOfNextInvoice),
    );
    if (row) {
      result.invoiceNo =
        getSingle(row.NextInvoiceOfNextInvoice) || fallbackInvoiceNo;
      result.posTransactionId = getSingle(row.NextPosTransactionIDNumber);
      result.cai = getSingle(row.CAIOfNextInvoice);
      result.startingNo = getSingle(row.StartingNoOfNextInvoice);
      result.endingNo = getSingle(row.EndingNoOfNextInvoice);
      result.fechaVence = getSingle(row.FechaVenceRangoOfNextInvoice);
    }

    return result;
  }

  private async clearPumpSales(dto: CreateInvoiceInput): Promise<void> {
    for (const item of dto.items) {
      if (item.saleId) {
        await this.dispenserRepo.updateSaleInvoiced(
          item.saleId.toString(),
          dto.posNo,
        );
      }
      if (item.code.startsWith('GAS-')) {
        const pumpId = parseInt(item.code.replace('GAS-', ''), 10);
        if (!isNaN(pumpId)) {
          this.dispensersService.clearPumpSale(pumpId);
        }
      }
    }
  }

  private async evaluateSorteos(
    dto: CreateInvoiceInput,
    posTransactionId: string,
  ): Promise<SorteoTicket[]> {
    try {
      return await this.sorteosService.evaluateSorteos({
        storeId: dto.storeId,
        posNo: dto.posNo,
        posTransactionId,
        total: dto.total,
        items: dto.items.map((it) => ({
          code: it.code,
          discount: it.discount,
          total: it.total,
        })),
        isCredit: !!dto.isCredit,
        payments: dto.payments.map((p) => ({
          method: p.method,
          code: p.code,
          amount: p.amount,
        })),
        customerNo: dto.customerNo,
      });
    } catch {
      return [];
    }
  }
}

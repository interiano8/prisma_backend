import { Injectable, Inject } from '@nestjs/common';
import {
  CreateInvoiceInput,
  CreditNoteInput,
} from '../../domain/entities/invoice.entity';
import { ValidateAdminUseCase } from '../use-cases/auth/validate-admin.use-case';
import { DispensersService } from './dispensers.service';
import { CampanasService, CampanaTicket } from './campanas.service';
import {
  computeLineTotals,
  LineTotals,
} from '../../domain/services/discount.service';
import { FUEL_DEFAULT_CODE, FUEL_CODE_PREFIX } from '../../domain/constants/business.constants';
import {
  BadRequestDomainError,
  NotFoundDomainError,
  ConflictDomainError,
} from '../../domain/errors/domain-error';
import { Mutex } from '../../utils/mutex';
import { InvoiceLealProcessor } from './invoice-leal.processor';
import { InvoiceResultMapper } from './invoice-result.mapper';
import type {
  InvoiceRepository,
  InvoiceLineItem,
  InvoicePaymentItem,
  InvoiceLineRow,
  PaymentMethodRow,
  OriginalDocumentRow,
  InvoiceInsertResultRow,
} from '../../domain/ports/out/invoice-repository.interface';
import type { InvoiceQueryRepository } from '../../domain/ports/out/invoice-query-repository.interface';
import type { DispenserRepository } from '../../domain/ports/out/dispenser-repository.interface';
import type { StoreConfigRepository } from '../../domain/ports/out/store-config-repository.interface';

const createInvoiceMutex = new Mutex();

interface CreditNoteUser {
  storeId: string;
  posNo: string;
  username?: string;
  name?: string;
}


@Injectable()
export class InvoicesService {
  private readonly resultMapper = new InvoiceResultMapper();
  constructor(
    @Inject('InvoiceRepository')
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('InvoiceQueryRepository')
    private readonly invoiceQueryRepo: InvoiceQueryRepository,
    @Inject('DispenserRepository')
    private readonly dispenserRepo: DispenserRepository,
    @Inject('StoreConfigRepository')
    private readonly storeConfigRepo: StoreConfigRepository,
    private readonly dispensersService: DispensersService,
    private readonly campanasService: CampanasService,
    private readonly lealProcessor: InvoiceLealProcessor,
    private readonly validateAdminUseCase: ValidateAdminUseCase,
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
    const { shiftDate: dbShiftDate, employeeName: dbEmployeeName, shiftId: dbShiftId } =
      await this.invoiceQueryRepo.getShiftDetails(
        dto.storeId,
        dto.posNo,
        dto.shiftNumber.toString(),
        dto.employeeName,
      );
    // Ignore client provided shiftDate to prevent timezone drift, always use the DB shift date
    const shiftDate = dbShiftDate;
    const employeeName = dto.employeeName || dbEmployeeName;

    const lines = await this.buildInvoiceLines(dto);
    const payments = this.resultMapper.buildInvoicePayments(dto);

    const { invoiceNo: predictedInvoiceNo } =
      await this.invoiceQueryRepo.findNextCorrelative(dto.storeId, dto.posNo);

    // Validar rango fiscal ANTES de procesar Leal/insertar: si no hay rango válido,
    // abortar con motivo claro y evitar operaciones Leal huérfanas con correlativo predicido.
    const rangeCheck = await this.invoiceQueryRepo.validateCorrelative(
      dto.storeId,
      dto.posNo,
      !!dto.isTicket,
    );
    if (!rangeCheck.isValid) {
      throw new BadRequestDomainError(rangeCheck.message);
    }

    // 1. Procesar Leal ANTES de insertar la factura (para validar OTP y evitar facturas huérfanas)
    const { redemptions: lealRedemptionResults, message: redemptionMessage } =
      await this.lealProcessor.processRedemptions(dto, predictedInvoiceNo);
    const { result: lealAccumulationResult, message: accumulationMessage } =
      await this.lealProcessor.processAccumulation(dto, predictedInvoiceNo);
    const lealReprintMessage = redemptionMessage + accumulationMessage;

    // 2. Insertar factura en DB (solo si Leal se procesó correctamente)
    let executeResult;
    try {
      executeResult = await this.invoiceRepo.executeInvoiceInsert({
        storeId: dto.storeId,
        posNo: dto.posNo,
        employeeName,
        shiftDate,
        shiftNumber: dto.shiftNumber.toString(),
        shiftId: dbShiftId ?? null,
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
        onCommit: async (tx, posTransactionId) => {
          for (const lealRow of this.lealProcessor.buildTransactions(
            dto,
            posTransactionId,
            lealRedemptionResults,
            lealAccumulationResult,
          )) {
            await tx.ventaLeal.create({
              data: {
                idTransaccionPos: lealRow.posTransactionId,
                idTransaccionLeal: lealRow.idTransaccionLeal,
                puntos: lealRow.puntos,
                puntosActivos: lealRow.puntosActivos,
                tipo: lealRow.tipo,
                dni: lealRow.dni,
                nombre: lealRow.nombre,
                idAleatorio:
                  lealRow.idAleatorio && !isNaN(Number(lealRow.idAleatorio))
                    ? BigInt(lealRow.idAleatorio)
                    : null,
              },
            });
          }
          return this.evaluateCampanasConTx(tx, dto, posTransactionId);
        },
      });
    } catch (e) {
      // Compensar operaciones Leal ya procesadas si el insert falló
      if (lealRedemptionResults.length > 0 || lealAccumulationResult) {
        try {
          await this.lealProcessor.compensate({
            redemptions: lealRedemptionResults,
            accumulationResult: lealAccumulationResult,
            lealIdAleatorioRed: dto.lealIdAleatorioRed,
            lealIdAleatorioAcum: dto.lealIdAleatorioAcum,
            predictedInvoiceNo,
          });
        } catch (compErr: any) {
          console.warn(
            '[Leal] Error en compensación post-fallo de insert:',
            compErr?.message,
          );
        }
      }
      throw e;
    }

    const extracted = this.resultMapper.extractInvoiceResult(executeResult, dto);

    await this.clearPumpSales(dto);

    return {
      success: true,
      invoiceNo: extracted.invoiceNo,
      posTransactionId: extracted.posTransactionId,
      cai: extracted.cai,
      startingNo: extracted.startingNo,
      endingNo: extracted.endingNo,
      fechaVence: extracted.fechaVence,
      createdAt: new Date().toISOString(),
      campanaTickets: extracted.campanaTickets,
      lealReprintMessage,
      seriesRemaining: extracted.seriesRemaining ?? 0,
      seriesRemainingDays: extracted.seriesRemainingDays ?? 0,
    };
  }

  async createTicketForPendingSale(
    saleId: number,
    opts: {
      storeId: string;
      posNo: string;
      shiftNumber: string;
      employeeName?: string;
      customerNo: string;
      customerName: string;
      customerRtn?: string;
      comment?: string;
    },
  ) {
    const sale = await this.dispenserRepo.getSaleById(saleId);
    if (!sale) {
      throw new NotFoundDomainError(
        `No se encontró la transacción de combustible #${saleId}.`,
      );
    }
    if (sale.IsInvoiced) {
      throw new ConflictDomainError(
        `La transacción de combustible #${saleId} ya fue documentada.`,
      );
    }
    const dto: CreateInvoiceInput = {
      storeId: opts.storeId,
      posNo: opts.posNo,
      shiftNumber: opts.shiftNumber,
      employeeName: opts.employeeName ?? '',
      customerNo: opts.customerNo,
      customerName: opts.customerName,
      customerRtn: opts.customerRtn ?? '',
      items: [
        {
          code: FUEL_DEFAULT_CODE,
          description: 'Salida de combustible',
          qty: sale.volume,
          price: sale.ppu,
          tax: 0,
          discount: 0,
          total: sale.amount,
          saleId,
        },
      ],
      payments: [],
      total: sale.amount,
      tax: 0,
      discount: 0,
      isTicket: true,
      comment: opts.comment ?? '',
    };
    return this.createInvoice(dto);
  }

  async validateCorrelative(storeId: string, posNo: string, isTicket: boolean) {
    return this.invoiceQueryRepo.validateCorrelative(storeId, posNo, isTicket);
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
    return this.invoiceQueryRepo.searchInvoices({
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
    return this.invoiceQueryRepo.getInvoiceLines(transactionId);
  }

  async getInvoicePayments(transactionId: string) {
    return this.invoiceQueryRepo.getInvoicePayments(transactionId);
  }

  async getInvoiceLealMessage(
    transactionId: string,
  ): Promise<{ lealReprintMessage: string }> {
    try {
      const rows =
        await this.invoiceQueryRepo.getInvoiceLealTransactions(transactionId);
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

  async getInvoiceCampanas(transactionId: string): Promise<any[]> {
    return this.invoiceQueryRepo.getInvoiceCampanas(transactionId);
  }

  async getReasons(): Promise<any[]> {
    return this.invoiceQueryRepo.getReasons();
  }

  async processCreditNote(dto: CreditNoteInput, user: CreditNoteUser) {
    if (!dto.adminPassword) {
      throw new BadRequestDomainError('Se requiere la contraseña de administrador para emitir una Nota de Crédito.');
    }
    try {
      await this.validateAdminUseCase.execute({
        storeId: user.storeId,
        password: dto.adminPassword,
      });
    } catch {
      throw new BadRequestDomainError('Contraseña de administrador inválida.');
    }

    const shiftData = await this.invoiceQueryRepo.getOpenShiftForEmployee(
      user.storeId,
      user.name || user.username || '',
    );
    if (!shiftData) {
      throw new BadRequestDomainError(
        'No tiene un turno abierto para este usuario. Por favor, abra un turno.',
      );
    }

    const headerRow = (await this.invoiceQueryRepo.getOriginalDocument(
      dto.invoiceNo,
      dto.transactionId,
    )) as OriginalDocumentRow | null;
    if (!headerRow) {
      throw new NotFoundDomainError(
        `No se encontró el documento original ${dto.invoiceNo} en la base de datos.`,
      );
    }

    const docTypeStr = headerRow['POS Sales Doc_ Type']?.toString();
    if (docTypeStr?.trim() !== '1' && docTypeStr?.trim() !== '2') {
      throw new BadRequestDomainError(
        'No se puede anular este documento. Solo se puede hacer devolucion de facturas.',
      );
    }

    const hasReversion = await this.invoiceQueryRepo.checkExistingReversion(
      dto.invoiceNo,
      dto.transactionId,
    );
    if (hasReversion) {
      throw new ConflictDomainError(
        `La factura ${dto.invoiceNo} ya tiene una Nota de Crédito generada.`,
      );
    }

    await this.invoiceQueryRepo.findNextCreditNoteCorrelative(
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
        shiftId: (shiftData as any)['POS Transaction ID'] ?? null,
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
        numeroLinea: (headerRow as any).numeroLinea ?? null,
      });

    const getLines = (await this.invoiceQueryRepo.getInvoiceLines(
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

    const getCharges = (await this.invoiceQueryRepo.getInvoicePayments(
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
    return this.invoiceQueryRepo.findAll();
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
      let montoControlador: number | null = null;
      let pumpNo = '';
      let pumpPositionNo = '';
      let tankNo = '';
      let itemCategoryCode = '';
      let genPumpLedgEntry = 0;
      let vatProdPostingGroup = '';
      let saleIdVal = '';
      let unidadMedida: string | null = null;
      let turnoControlador: string | null = null;

      if (item.saleId) {
        const sale = await this.dispenserRepo.getSaleById(item.saleId);
        if (!sale) {
          throw new NotFoundDomainError(
            `No se encontró la transacción de combustible #${item.saleId} en FusionController.`,
          );
        }
        if (sale.IsInvoiced) {
          throw new ConflictDomainError(
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
        // El monto del controlador (sale.amount) es la autoridad: el ppu del surtidor
        // está redondeado y `ppu × volumen` puede diferir del cobro real.
        montoControlador = sale.amount - (item.discount || 0);
        saleIdVal = item.saleId.toString();
        genPumpLedgEntry = 1;
        turnoControlador = sale.ShiftId != null ? String(sale.ShiftId) : null;

        const hoseFs = await this.dispenserRepo.getHoseFsMapping(
          sale.PumpNumber,
          parseInt(sale.HoseNumber, 10),
        );
        if (hoseFs) {
          itemCode = hoseFs.CodigoPOS || FUEL_DEFAULT_CODE;
          tankNo = (hoseFs.TankIDs || '').toString();
          unidadMedida = hoseFs.unidadMedida ?? null;
        }
      }

      const meta = await this.dispenserRepo.getItemMetadata(itemCode);
      if (meta) {
        description = meta.Description || description;
        vatProdPostingGroup = meta['VAT Prod_ Posting Group'] || '';
        itemCategoryCode = meta['Item Category Code'] || '';
        if (!item.saleId) {
          genPumpLedgEntry = meta['Gen_ Pump Ledg_ Entry'] || 0;
          unidadMedida = meta.UnidadMedida ?? null;
        }
      }

      const cleanGroup = vatProdPostingGroup.toUpperCase();
      let vatPercent = 0.0;
      if (cleanGroup) {
        vatPercent = await this.storeConfigRepo.findTasaByGrupo(cleanGroup);
      }

      const discount = item.discount || 0;
      let totals: LineTotals;
      if (montoControlador != null) {
        // Combustible: el monto del controlador es la autoridad. Si es gravado,
        // la base se deriva del monto total (que incluye el ISV).
        const montoConIsv = Math.max(0, montoControlador);
        const baseRaw =
          vatPercent > 0 ? montoConIsv / (1 + vatPercent / 100) : montoConIsv;
        const base = Math.round(baseRaw * 100) / 100;
        const montoIsv = Math.round(base * (vatPercent / 100) * 100) / 100;
        totals = {
          baseGravadaTotal: base,
          descuento: discount,
          baseDescontada: base,
          montoIsv,
          montoConIsv,
        };
      } else {
        totals = computeLineTotals(unitPrice, quantity, vatPercent, discount);
      }

      lines.push({
        lineNo,
        itemCode,
        description,
        quantity,
        unitPrice,
        discountPercentage: item.discountPercentage || 0,
        discount: totals.descuento,
        vatPercent,
        vatAmount: totals.montoIsv,
        amountIncludingVAT: totals.montoConIsv,
        montoGravado: totals.baseDescontada,
        pumpNo,
        pumpPositionNo,
        tankNo,
        unidadMedida,
        turnoControlador,
        itemCategoryCode,
        genPumpLedgEntry,
        vatProdPostingGroup,
        saleId: saleIdVal,
      });
      lineNo += 10;
    }

    return lines;
  }

  private async clearPumpSales(dto: CreateInvoiceInput): Promise<void> {
    for (const item of dto.items) {
      if (item.code.startsWith(FUEL_CODE_PREFIX)) {
        const pumpId = parseInt(item.code.replace(FUEL_CODE_PREFIX, ''), 10);
        if (!isNaN(pumpId)) {
          this.dispensersService.clearPumpSale(pumpId);
        }
        if (item.saleId != null) {
          try {
            await this.dispenserRepo.updateSaleInvoiced(
              String(item.saleId),
              dto.posNo,
            );
          } catch (err) {
            console.warn(
              `[Factura] No se pudo marcar facturada la venta #${item.saleId} en wayne:`,
              (err as Error).message,
            );
          }
        }
      }
    }
  }

  private async evaluateCampanasConTx(
    tx: any,
    dto: CreateInvoiceInput,
    posTransactionId: string,
  ): Promise<CampanaTicket[]> {
    try {
      return await this.campanasService.evaluateCampanas(
        {
          storeId: dto.storeId,
          posNo: dto.posNo,
          posTransactionId,
          total: dto.total,
          items: dto.items.map((it) => ({
            code: it.code,
            discount: it.discount,
            total: it.total,
            quantity: it.qty ?? 0,
          })),
          isCredit: !!dto.isCredit,
          payments: dto.payments.map((p) => ({
            method: p.method,
            code: p.code,
            amount: p.amount,
          })),
          customerNo: dto.customerNo,
        },
        tx,
      );
    } catch {
      return [];
    }
  }

  private async evaluateCampanas(
    dto: CreateInvoiceInput,
    posTransactionId: string,
  ): Promise<CampanaTicket[]> {
    try {
      return await this.campanasService.evaluateCampanas({
        storeId: dto.storeId,
        posNo: dto.posNo,
        posTransactionId,
        total: dto.total,
        items: dto.items.map((it) => ({
          code: it.code,
          discount: it.discount,
          total: it.total,
          quantity: it.qty ?? 0,
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

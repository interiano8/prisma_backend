import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { InvoicesService } from '../../../application/services/invoices.service';
import { CreateInvoiceDto } from '../dto/invoice/create-invoice.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.createInvoice(dto);
  }

  @Post('pending-sale-ticket')
  @HttpCode(HttpStatus.OK)
  async createPendingSaleTicket(
    @Body()
    body: {
      saleId: number;
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
    return this.invoicesService.createTicketForPendingSale(body.saleId, body);
  }

  @Get('reasons')
  async getReasons() {
    return this.invoicesService.getReasons();
  }

  @Post('credit-note')
  @HttpCode(HttpStatus.OK)
  async createCreditNote(
    @Body() dto: import('../dto/invoice/credit-note.dto').CreditNoteDto,
  ) {
    const user = {
      storeId: dto.storeId ?? '',
      posNo: dto.posNo ?? '',
      username: dto.username ?? '',
      name: dto.username ?? '',
    };
    return this.invoicesService.processCreditNote(dto, user);
  }

  @Post('renew-transactions')
  @HttpCode(HttpStatus.OK)
  async renewTransactions() {
    return this.invoicesService.renewTransactions();
  }

  @Get()
  async getInvoices(): Promise<any[]> {
    return this.invoicesService.getInvoices();
  }

  @Get('validate-correlative')
  async validateCorrelative(
    @Query('storeId') storeId: string,
    @Query('posNo') posNo: string,
    @Query('isTicket') isTicket?: string,
  ) {
    const isTicketBool = isTicket === 'true';
    return this.invoicesService.validateCorrelative(
      storeId,
      posNo,
      isTicketBool,
    );
  }

  @Get('search')
  async searchInvoices(
    @Query('storeId') storeId: string,
    @Query('avanzado') avanzado: string,
    @Query('posNo') posNo?: string,
    @Query('turno') turno?: string,
    @Query('fechaTurno') fechaTurno?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('factura') factura?: string,
    @Query('customerName') customerName?: string,
    @Query('employeeName') employeeName?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const isAvanzado = avanzado === 'true';
    return this.invoicesService.searchInvoices(
      storeId,
      isAvanzado,
      posNo,
      turno,
      fechaTurno,
      fechaDesde,
      fechaHasta,
      factura,
      customerName,
      employeeName,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get(':transactionId/lines')
  async getInvoiceLines(@Param('transactionId') transactionId: string) {
    return this.invoicesService.getInvoiceLines(transactionId);
  }

  @Get(':transactionId/payments')
  async getInvoicePayments(@Param('transactionId') transactionId: string) {
    return this.invoicesService.getInvoicePayments(transactionId);
  }

  @Get(':transactionId/leal-message')
  async getInvoiceLealMessage(@Param('transactionId') transactionId: string) {
    return this.invoicesService.getInvoiceLealMessage(transactionId);
  }

  @Get(':transactionId/campanas')
  async getInvoiceCampanas(@Param('transactionId') transactionId: string) {
    return this.invoicesService.getInvoiceCampanas(transactionId);
  }
}

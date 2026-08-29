import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../../src/infrastructure/web/controllers/invoices.controller';
import { InvoicesService } from '../../src/application/services/invoices.service';
import { CreateInvoiceDto } from '../../src/infrastructure/web/dto/invoice/create-invoice.dto';
import { CreditNoteDto } from '../../src/infrastructure/web/dto/invoice/credit-note.dto';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let mockService: {
    createInvoice: jest.Mock;
    getReasons: jest.Mock;
    processCreditNote: jest.Mock;
    renewTransactions: jest.Mock;
    getInvoices: jest.Mock;
    validateCorrelative: jest.Mock;
    searchInvoices: jest.Mock;
    getInvoiceLines: jest.Mock;
    getInvoicePayments: jest.Mock;
    getInvoiceLealMessage: jest.Mock;
    getInvoiceSorteos: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      createInvoice: jest.fn(),
      getReasons: jest.fn(),
      processCreditNote: jest.fn(),
      renewTransactions: jest.fn(),
      getInvoices: jest.fn(),
      validateCorrelative: jest.fn(),
      searchInvoices: jest.fn(),
      getInvoiceLines: jest.fn(),
      getInvoicePayments: jest.fn(),
      getInvoiceLealMessage: jest.fn(),
      getInvoiceSorteos: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: mockService }],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  it('createInvoice delega en el servicio', async () => {
    mockService.createInvoice.mockResolvedValue({ success: true });
    const dto = { storeId: '001' } as CreateInvoiceDto;

    expect(await controller.createInvoice(dto)).toEqual({ success: true });
    expect(mockService.createInvoice).toHaveBeenCalledWith(dto);
  });

  it('getReasons delega en el servicio', async () => {
    mockService.getReasons.mockResolvedValue([]);

    expect(await controller.getReasons()).toEqual([]);
  });

  it('createCreditNote pasa el usuario derivado del dto', async () => {
    mockService.processCreditNote.mockResolvedValue({ success: true });
    const dto = {
      storeId: '001',
      posNo: 'POS01',
      username: 'jdoe',
      reason: 'Error',
      invoiceNo: 'F001',
    } as CreditNoteDto;

    await controller.createCreditNote(dto);

    expect(mockService.processCreditNote).toHaveBeenCalledWith(dto, {
      storeId: '001',
      posNo: 'POS01',
      username: 'jdoe',
      name: 'jdoe',
    });
  });

  it('renewTransactions delega en el servicio', async () => {
    mockService.renewTransactions.mockResolvedValue(0);

    expect(await controller.renewTransactions()).toBe(0);
  });

  it('getInvoices delega en el servicio', async () => {
    mockService.getInvoices.mockResolvedValue([]);

    expect(await controller.getInvoices()).toEqual([]);
  });

  it('validateCorrelative traduce isTicket', async () => {
    mockService.validateCorrelative.mockResolvedValue({ isValid: true });

    await controller.validateCorrelative('001', 'POS01', 'true');

    expect(mockService.validateCorrelative).toHaveBeenCalledWith(
      '001',
      'POS01',
      true,
    );
  });

  it('searchInvoices traduce avanzado y reenvía filtros', async () => {
    mockService.searchInvoices.mockResolvedValue([]);

    await controller.searchInvoices('001', 'true', 'POS01', '1', '2026-01-15');

    expect(mockService.searchInvoices).toHaveBeenCalledWith(
      '001',
      true,
      'POS01',
      '1',
      '2026-01-15',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('getInvoiceLines delega en el servicio', async () => {
    mockService.getInvoiceLines.mockResolvedValue([]);

    expect(await controller.getInvoiceLines('TX1')).toEqual([]);
    expect(mockService.getInvoiceLines).toHaveBeenCalledWith('TX1');
  });

  it('getInvoicePayments delega en el servicio', async () => {
    mockService.getInvoicePayments.mockResolvedValue([]);

    expect(await controller.getInvoicePayments('TX1')).toEqual([]);
  });

  it('getInvoiceLealMessage delega en el servicio', async () => {
    mockService.getInvoiceLealMessage.mockResolvedValue(null);

    expect(await controller.getInvoiceLealMessage('TX1')).toBeNull();
  });

  it('getInvoiceSorteos delega en el servicio', async () => {
    mockService.getInvoiceSorteos.mockResolvedValue([]);

    expect(await controller.getInvoiceSorteos('TX1')).toEqual([]);
  });
});

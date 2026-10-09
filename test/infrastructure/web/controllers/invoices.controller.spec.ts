import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../../../../src/infrastructure/web/controllers/invoices.controller';
import { InvoicesService } from '../../../../src/application/services/invoices.service';
import { ReclassifySaleUseCase } from '../../../../src/application/use-cases/sale/reclassify-sale.use-case';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let reclassifyUseCase: { execute: jest.Mock };
  let service: { [K in keyof InvoicesService]: jest.Mock };

  beforeEach(async () => {
    reclassifyUseCase = { execute: jest.fn() };
    service = {
      createInvoice: jest.fn(),
      createTicketForPendingSale: jest.fn(),
      getReasons: jest.fn(),
      processCreditNote: jest.fn(),
      renewTransactions: jest.fn(),
      getInvoices: jest.fn(),
      validateCorrelative: jest.fn(),
      searchInvoices: jest.fn(),
      getInvoiceLines: jest.fn(),
      getInvoicePayments: jest.fn(),
      getInvoiceLealMessage: jest.fn(),
      getInvoiceCampanas: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: service },
        { provide: ReclassifySaleUseCase, useValue: reclassifyUseCase },
      ],
    }).compile();

    controller = module.get(InvoicesController);
  });

  it('createInvoice delega en el service', async () => {
    const dto = { storeId: '001' } as never;
    service.createInvoice.mockResolvedValue({ success: true });

    await expect(controller.createInvoice(dto)).resolves.toEqual({
      success: true,
    });
    expect(service.createInvoice).toHaveBeenCalledWith(dto);
  });

  it('createCreditNote mapea el usuario con fallbacks', async () => {
    service.processCreditNote.mockResolvedValue({ success: true });

    await controller.createCreditNote({
      invoiceNo: 'F1',
      transactionId: 'TX1',
      reason: 'R',
      adminPassword: 'secret',
    });

    expect(service.processCreditNote).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ storeId: '', posNo: '', username: '' }),
    );
  });

  it('createCreditNote usa los datos provistos', async () => {
    service.processCreditNote.mockResolvedValue({ success: true });

    await controller.createCreditNote({
      storeId: '001',
      posNo: '01',
      username: 'jdoe',
      invoiceNo: 'F1',
      transactionId: 'TX1',
      reason: 'R',
      adminPassword: 'secret',
    });

    expect(service.processCreditNote).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ storeId: '001', posNo: '01', name: 'jdoe' }),
    );
  });

  it('validateCorrelative convierte isTicket', async () => {
    service.validateCorrelative.mockResolvedValue({ valid: true });

    await controller.validateCorrelative('001', '01', 'true');
    expect(service.validateCorrelative).toHaveBeenLastCalledWith(
      '001',
      '01',
      true,
    );

    await controller.validateCorrelative('001', '01', undefined);
    expect(service.validateCorrelative).toHaveBeenLastCalledWith(
      '001',
      '01',
      false,
    );
  });

  it('searchInvoices convierte avanzado', async () => {
    service.searchInvoices.mockResolvedValue([]);

    await controller.searchInvoices('001', 'true');
    expect(service.searchInvoices).toHaveBeenLastCalledWith(
      '001',
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    await controller.searchInvoices('001', 'false');
    expect(service.searchInvoices).toHaveBeenLastCalledWith(
      '001',
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('delega los getters de factura', async () => {
    service.getInvoiceLines.mockResolvedValue([]);
    service.getInvoicePayments.mockResolvedValue([]);
    service.getInvoiceLealMessage.mockResolvedValue({ lealReprintMessage: '' });
    service.getInvoiceCampanas.mockResolvedValue([]);
    service.getReasons.mockResolvedValue([]);
    service.getInvoices.mockResolvedValue([]);
    service.renewTransactions.mockResolvedValue({ success: true });

    await controller.getInvoiceLines('TX1');
    await controller.getInvoicePayments('TX1');
    await controller.getInvoiceLealMessage('TX1');
    await controller.getInvoiceCampanas('TX1');
    await controller.getReasons();
    await controller.getInvoices();
    await controller.renewTransactions();

    expect(service.getInvoiceLines).toHaveBeenCalledWith('TX1');
    expect(service.getInvoicePayments).toHaveBeenCalledWith('TX1');
    expect(service.getInvoiceLealMessage).toHaveBeenCalledWith('TX1');
    expect(service.getInvoiceCampanas).toHaveBeenCalledWith('TX1');
    expect(service.getReasons).toHaveBeenCalled();
    expect(service.getInvoices).toHaveBeenCalled();
    expect(service.renewTransactions).toHaveBeenCalled();
  });

  it('createPendingSaleTicket delega en el servicio', async () => {
    service.createTicketForPendingSale.mockResolvedValue({ success: true });
    const body = {
      saleId: 123,
      storeId: '001',
      posNo: '01',
      shiftNumber: '1',
      customerNo: 'CF',
      customerName: 'CONSUMIDOR FINAL',
    };
    const res = await controller.createPendingSaleTicket(body);
    expect(service.createTicketForPendingSale).toHaveBeenCalledWith(123, body);
    expect(res).toEqual({ success: true });
  });
});

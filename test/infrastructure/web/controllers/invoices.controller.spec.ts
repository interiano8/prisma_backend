import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../../../../src/infrastructure/web/controllers/invoices.controller';
import { InvoicesService } from '../../../../src/application/services/invoices.service';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: { [K in keyof InvoicesService]: jest.Mock };

  beforeEach(async () => {
    service = {
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
      providers: [{ provide: InvoicesService, useValue: service }],
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
    );
  });

  it('delega los getters de factura', async () => {
    service.getInvoiceLines.mockResolvedValue([]);
    service.getInvoicePayments.mockResolvedValue([]);
    service.getInvoiceLealMessage.mockResolvedValue({ lealReprintMessage: '' });
    service.getInvoiceSorteos.mockResolvedValue([]);
    service.getReasons.mockResolvedValue([]);
    service.getInvoices.mockResolvedValue([]);
    service.renewTransactions.mockResolvedValue({ success: true });

    await controller.getInvoiceLines('TX1');
    await controller.getInvoicePayments('TX1');
    await controller.getInvoiceLealMessage('TX1');
    await controller.getInvoiceSorteos('TX1');
    await controller.getReasons();
    await controller.getInvoices();
    await controller.renewTransactions();

    expect(service.getInvoiceLines).toHaveBeenCalledWith('TX1');
    expect(service.getInvoicePayments).toHaveBeenCalledWith('TX1');
    expect(service.getInvoiceLealMessage).toHaveBeenCalledWith('TX1');
    expect(service.getInvoiceSorteos).toHaveBeenCalledWith('TX1');
    expect(service.getReasons).toHaveBeenCalled();
    expect(service.getInvoices).toHaveBeenCalled();
    expect(service.renewTransactions).toHaveBeenCalled();
  });
});

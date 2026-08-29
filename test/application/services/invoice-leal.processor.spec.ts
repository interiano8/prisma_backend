import { InvoiceLealProcessor } from '../../../src/application/services/invoice-leal.processor';
import type { LealRepository } from '../../../src/domain/ports/out/leal-repository.interface';
import type { InvoiceRepository } from '../../../src/domain/ports/out/invoice-repository.interface';
import type { CreateInvoiceInput } from '../../../src/domain/entities/invoice.entity';

const baseDto = (
  overrides: Partial<CreateInvoiceInput> = {},
): CreateInvoiceInput => ({
  storeId: '001',
  posNo: '01',
  shiftNumber: '1',
  customerNo: 'CF',
  customerName: 'Consumidor',
  items: [
    {
      code: 'P1',
      description: 'Producto',
      qty: 1,
      price: 100,
      tax: 15,
      discount: 0,
      total: 115,
    },
  ],
  payments: [],
  total: 115,
  tax: 15,
  discount: 0,
  ...overrides,
});

describe('InvoiceLealProcessor', () => {
  let processor: InvoiceLealProcessor;
  let lealRepo: jest.Mocked<LealRepository>;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;

  beforeEach(() => {
    lealRepo = {
      redeemPoints: jest.fn(),
      accumulatePoints: jest.fn(),
      reverseTransaction: jest.fn(),
    } as unknown as jest.Mocked<LealRepository>;
    invoiceRepo = {
      insertLealTransactions: jest.fn(),
      getInvoiceLines: jest.fn(),
    } as unknown as jest.Mocked<InvoiceRepository>;
    processor = new InvoiceLealProcessor(lealRepo, invoiceRepo);
  });

  describe('processRedemptions', () => {
    it('devuelve vacío si no hay pagos Leal', async () => {
      const result = await processor.processRedemptions(baseDto(), 'FAC-1');

      expect(result).toEqual({ redemptions: [], message: '' });
      expect(lealRepo.redeemPoints).not.toHaveBeenCalled();
    });

    it('redime puntos por cada pago Leal', async () => {
      lealRepo.redeemPoints.mockResolvedValue({
        puntos_activos: 80,
        id_transaccion: 'T1',
      });

      const dto = baseDto({
        payments: [
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 50,
            lealData: { uid: 'U1', puntos: 100, idPremio: 7, otp: '123' },
          },
        ],
      });

      const result = await processor.processRedemptions(dto, 'FAC-1');

      expect(lealRepo.redeemPoints).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'U1', points: 100 }),
      );
      expect(result.redemptions).toEqual([
        { puntos: 100, puntosActivos: 80, idTransaccionLeal: 'T1' },
      ]);
      expect(result.message).toContain('Puntos Redimidos: 100');
    });

    it('usa data anidada como fallback de puntos activos e id', async () => {
      lealRepo.redeemPoints.mockResolvedValue({
        data: { puntos_activos: 30, id_transaccion: 'TD' },
      });

      const dto = baseDto({
        payments: [
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 50,
            lealData: { uid: 'U1', puntos: 20 },
          },
        ],
      });

      const result = await processor.processRedemptions(dto, 'FAC-1');

      expect(result.redemptions).toEqual([
        { puntos: 20, puntosActivos: 30, idTransaccionLeal: 'TD' },
      ]);
    });

    it('usa 0 y cadena vacía si el resultado no trae datos', async () => {
      lealRepo.redeemPoints.mockResolvedValue({});

      const dto = baseDto({
        payments: [
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 50,
            lealData: { uid: 'U1' },
          },
        ],
      });

      const result = await processor.processRedemptions(dto, 'FAC-1');

      expect(result.redemptions).toEqual([
        { puntos: 0, puntosActivos: 0, idTransaccionLeal: '' },
      ]);
    });
  });

  describe('processAccumulation', () => {
    it('devuelve null si no hay acumulación', async () => {
      const result = await processor.processAccumulation(baseDto(), 'FAC-1');

      expect(result).toEqual({ result: null, message: '' });
      expect(lealRepo.accumulatePoints).not.toHaveBeenCalled();
    });

    it('acumula puntos cuando hay uid y aleatorioAcum', async () => {
      lealRepo.accumulatePoints.mockResolvedValue({
        puntos: 50,
        puntos_activos: 60,
        id_transaccion: 'TA',
      });

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
        payments: [{ method: 'EFECTIVO', code: '01', amount: 100 }],
      });

      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result.result).toEqual({
        puntos: 50,
        puntosActivos: 60,
        idTransaccionLeal: 'TA',
      });
      expect(result.message).toContain('Puntos Acumulados: 50');
    });

    it('usa data anidada como fallback de acumulación', async () => {
      lealRepo.accumulatePoints.mockResolvedValue({
        data: { puntos: 40, puntos_activos: 45, id_transaccion: 'TD2' },
      });

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
      });

      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result.result).toEqual({
        puntos: 40,
        puntosActivos: 45,
        idTransaccionLeal: 'TD2',
      });
    });

    it('no bloquea y devuelve mensaje si acumular falla', async () => {
      lealRepo.accumulatePoints.mockRejectedValue(new Error('leal down'));

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
      });

      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result.result).toBeNull();
      expect(result.message).toContain('No se pudo acumular en Leal');
    });
  });

  describe('persistTransactions', () => {
    it('persiste redenciones y acumulación en un solo lote atómico', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({ lealCustomerDni: '0801' }),
        'TX1',
        [{ puntos: 10, puntosActivos: 5, idTransaccionLeal: 'R1' }],
        { puntos: 20, puntosActivos: 15, idTransaccionLeal: 'A1' },
      );

      expect(invoiceRepo.insertLealTransactions).toHaveBeenCalledTimes(1);
      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ tipo: 1, idTransaccionLeal: 'R1' });
      expect(rows[1]).toMatchObject({ tipo: 0, idTransaccionLeal: 'A1' });
    });

    it('persiste solo redenciones sin acumulación', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto(),
        'TX1',
        [{ puntos: 10, puntosActivos: 5, idTransaccionLeal: 'R1' }],
        null,
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ tipo: 1, idTransaccionLeal: 'R1' });
    });
  });

  describe('reverseForCreditNote', () => {
    it('revierte cada línea con id aleatorio', async () => {
      invoiceRepo.getInvoiceLines.mockResolvedValue([
        { IDAleatorio: 'A1', IdTransaccionLeal: 11 },
        { IDAleatorio: null, IdTransaccionLeal: 22 },
      ] as never);

      await processor.reverseForCreditNote('TX1');

      expect(lealRepo.reverseTransaction).toHaveBeenCalledTimes(1);
      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith('11', 'A1', '');
    });

    it('captura errores de reversión', async () => {
      invoiceRepo.getInvoiceLines.mockResolvedValue([
        { IDAleatorio: 'A1', IdTransaccionLeal: 11 },
      ] as never);
      lealRepo.reverseTransaction.mockRejectedValue(new Error('leal'));

      await expect(
        processor.reverseForCreditNote('TX1'),
      ).resolves.toBeUndefined();
    });
  });
});

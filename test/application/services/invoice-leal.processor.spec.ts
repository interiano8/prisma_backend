import { InvoiceLealProcessor } from '../../../src/application/services/invoice-leal.processor';
import type { LealRepository } from '../../../src/domain/ports/out/leal-repository.interface';
import type { InvoiceRepository } from '../../../src/domain/ports/out/invoice-repository.interface';
import type { InvoiceQueryRepository } from '../../../src/domain/ports/out/invoice-query-repository.interface';
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
  let invoiceQueryRepo: jest.Mocked<InvoiceQueryRepository>;

  beforeEach(() => {
    lealRepo = {
      redeemPoints: jest.fn(),
      accumulatePoints: jest.fn(),
      reverseTransaction: jest.fn(),
    } as unknown as jest.Mocked<LealRepository>;
    invoiceQueryRepo = {
      getInvoiceLines: jest.fn(),
    } as unknown as jest.Mocked<InvoiceQueryRepository>;
    invoiceRepo = {
      insertLealTransactions: jest.fn(),
      getInvoiceLines: jest.fn(),
    } as unknown as jest.Mocked<InvoiceRepository>;
    processor = new InvoiceLealProcessor(lealRepo, invoiceRepo, invoiceQueryRepo);
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

    it('lanza BadRequestDomainError si el pago es Leal y no incluye lealData', async () => {
      const dto = baseDto({
        payments: [{ method: 'LEAL', code: 'LEAL', amount: 50 }],
      });

      await expect(processor.processRedemptions(dto, 'FAC-1')).rejects.toThrow(
        'El pago con Leal requiere datos de redención válidos (lealData).',
      );
      expect(lealRepo.redeemPoints).not.toHaveBeenCalled();
    });

    it('lanza BadRequestDomainError si lealData no incluye UID', async () => {
      const dto = baseDto({
        payments: [
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 50,
            lealData: { uid: '   ', puntos: 10 },
          },
        ],
      });

      await expect(processor.processRedemptions(dto, 'FAC-1')).rejects.toThrow(
        'El pago con Leal requiere el UID del cliente.',
      );
      expect(lealRepo.redeemPoints).not.toHaveBeenCalled();
    });

    it('lanza BadRequestDomainError si lealData tiene puntos <= 0 y no tiene idPremio', async () => {
      const dto = baseDto({
        payments: [
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 50,
            lealData: { uid: 'U1', puntos: 0 },
          },
        ],
      });

      await expect(processor.processRedemptions(dto, 'FAC-1')).rejects.toThrow(
        'El pago con Leal requiere puntos a redimir o un premio válido.',
      );
      expect(lealRepo.redeemPoints).not.toHaveBeenCalled();
    });

    it('lanza BadRequestDomainError si redeemPoints falla o rechaza', async () => {
      lealRepo.redeemPoints.mockRejectedValue(new Error('OTP inválido'));

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

      await expect(processor.processRedemptions(dto, 'FAC-1')).rejects.toThrow(
        'Error al procesar el pago con Leal: OTP inválido',
      );
    });

    it('lanza BadRequestDomainError si Leal devuelve resultado sin id_transaccion', async () => {
      lealRepo.redeemPoints.mockResolvedValue({});

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

      await expect(processor.processRedemptions(dto, 'FAC-1')).rejects.toThrow(
        'No se pudo confirmar el pago con Leal: No se recibió ID de transacción de Leal.',
      );
    });

    it('compensa redenciones previas si una posterior falla en la misma transacción', async () => {
      lealRepo.redeemPoints
        .mockResolvedValueOnce({ id_transaccion: 'T1', puntos_activos: 80 })
        .mockRejectedValueOnce(new Error('Saldo insuficiente'));

      const dto = baseDto({
        lealIdAleatorioRed: 'ALEATORIO-1',
        payments: [
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 25,
            lealData: { uid: 'U1', puntos: 25 },
          },
          {
            method: 'LEAL',
            code: 'LEAL',
            amount: 25,
            lealData: { uid: 'U1', puntos: 25 },
          },
        ],
      });

      await expect(processor.processRedemptions(dto, 'FAC-1')).rejects.toThrow(
        'Saldo insuficiente',
      );

      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith(
        'T1',
        'ALEATORIO-1',
        '',
      );
    });

    it('detecta pago Leal por código de fidelización configurado en BD', async () => {
      invoiceQueryRepo.getFidelizacionPaymentCodes = jest
        .fn()
        .mockResolvedValue(['1009']);

      lealRepo.redeemPoints.mockResolvedValue({
        id_transaccion: 'T-FID',
        puntos_activos: 50,
      });

      const dto = baseDto({
        payments: [
          {
            method: 'OTRO NOMBRE',
            code: '1009',
            amount: 30,
            lealData: { uid: 'U99', puntos: 30 },
          },
        ],
      });

      const result = await processor.processRedemptions(dto, 'FAC-1');

      expect(result.redemptions).toEqual([
        { puntos: 30, puntosActivos: 50, idTransaccionLeal: 'T-FID' },
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
      expect(lealRepo.accumulatePoints).toHaveBeenCalledWith({
        customerId: 'U1',
        invoiceNo: 'FAC-1',
        noFactura: 'ACC-1',
        total: 100,
        token: '',
        pin: undefined,
        totales: {
          SubTotal: 100,
          ImpuestoTotal: 15,
          DescuentoTotal: 0,
          FormaPago: 'EFECTIVO',
          TotalPersonas: 1,
          Fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
          FechaApertura: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
          FechaCierre: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
          Items: [
            {
              codigo: 'P1',
              descripcion: 'Producto',
              cantidad: 1,
              precio_unitario: 100,
              subtotal: 100,
              impuesto: 15,
              descuento: 0,
              total: 115,
            },
          ],
        },
      });
    });

    it('excluye pagos con keywords Leal del total acumulable', async () => {
      lealRepo.accumulatePoints.mockResolvedValue({
        puntos: 1,
        puntos_activos: 1,
        id_transaccion: 'TA',
      });

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
        payments: [
          { method: 'TARJETA LEAL', code: '01', amount: 90 },
          { method: 'EFECTIVO', code: '02', amount: 10 },
        ],
      });

      await processor.processAccumulation(dto, 'FAC-1');

      expect(lealRepo.accumulatePoints).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 10,
          totales: expect.objectContaining({
            FormaPago: 'EFECTIVO',
          }),
        }),
      );
    });

    it('une varios métodos de pago elegibles con coma y espacio', async () => {
      lealRepo.accumulatePoints.mockResolvedValue({
        puntos: 1,
        puntos_activos: 1,
        id_transaccion: 'TA',
      });

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
        payments: [
          { method: 'EFECTIVO', code: '01', amount: 50 },
          { method: 'TARJETA', code: '02', amount: 50 },
        ],
      });

      await processor.processAccumulation(dto, 'FAC-1');

      expect(lealRepo.accumulatePoints).toHaveBeenCalledWith(
        expect.objectContaining({
          totales: expect.objectContaining({ FormaPago: 'EFECTIVO, TARJETA' }),
        }),
      );
    });

    it('registra el error de acumulación en la consola y lanza BadRequestDomainError', async () => {
      lealRepo.accumulatePoints.mockRejectedValue(new Error('leal down'));
      const errSpy = jest.spyOn(console, 'error').mockImplementation();

      const dto = baseDto({ lealIdAleatorioAcum: 'ACC-1', lealCustomerUid: 'U1' });
      await expect(processor.processAccumulation(dto, 'FAC-1')).rejects.toThrow(
        'Error al acumular puntos en Leal: leal down. Puede reintentar la operación antes de emitir la factura.',
      );

      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error al acumular puntos en Leal'),
        expect.any(String),
      );
      errSpy.mockRestore();
    });

    it('usa data anidada cuando los puntos top-level son 0', async () => {
      lealRepo.accumulatePoints.mockResolvedValue({
        puntos: 0,
        puntos_activos: 0,
        data: { puntos: 7, puntos_activos: 8, id_transaccion: 'D' },
      });

      const dto = baseDto({ lealIdAleatorioAcum: 'ACC-1', lealCustomerUid: 'U1' });
      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result.result).toEqual({
        puntos: 7,
        puntosActivos: 8,
        idTransaccionLeal: 'D',
      });
    });

    it('no acumula si falta el uid aunque exista el aleatorio', async () => {
      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: undefined,
      });

      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result).toEqual({ result: null, message: '' });
      expect(lealRepo.accumulatePoints).not.toHaveBeenCalled();
    });

    it('calcula DescuentoTotal con descuento distinto de cero', async () => {
      lealRepo.accumulatePoints.mockResolvedValue({
        puntos: 1,
        puntos_activos: 1,
        id_transaccion: 'T',
      });

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
        discount: 10,
        payments: [{ method: 'EFECTIVO', code: '01', amount: 100 }],
      });

      await processor.processAccumulation(dto, 'FAC-1');

      expect(lealRepo.accumulatePoints).toHaveBeenCalledWith(
        expect.objectContaining({
          totales: expect.objectContaining({
            SubTotal: 100,
            ImpuestoTotal: 15,
            DescuentoTotal: 10,
          }),
        }),
      );
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

    it('lanza BadRequestDomainError si acumular falla para permitir reintentar', async () => {
      lealRepo.accumulatePoints.mockRejectedValue(new Error('leal down'));

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
      });

      await expect(processor.processAccumulation(dto, 'FAC-1')).rejects.toThrow(
        'Error al acumular puntos en Leal',
      );
    });

    it('permite continuar sin acumular si permitirFacturarSinAcumular es true', async () => {
      lealRepo.accumulatePoints.mockRejectedValue(new Error('leal down'));

      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
        permitirFacturarSinAcumular: true,
      });

      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result.result).toBeNull();
      expect(result.message).toContain('No se pudo acumular en Leal');
    });

    it('salta la acumulación si omitirAcumulacion es true', async () => {
      const dto = baseDto({
        lealIdAleatorioAcum: 'ACC-1',
        lealCustomerUid: 'U1',
        omitirAcumulacion: true,
      });

      const result = await processor.processAccumulation(dto, 'FAC-1');

      expect(result.result).toBeNull();
      expect(lealRepo.accumulatePoints).not.toHaveBeenCalled();
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
      expect(rows[0].idAleatorio).toBeNull();
      expect(rows[1].idAleatorio).toBeNull();
    });

    it('propaga lealIdAleatorioRed y lealIdAleatorioAcum a las filas', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({ lealIdAleatorioRed: 'RED-9', lealIdAleatorioAcum: 'ACC-9' }),
        'TX1',
        [{ puntos: 10, puntosActivos: 5, idTransaccionLeal: 'R1' }],
        { puntos: 20, puntosActivos: 15, idTransaccionLeal: 'A1' },
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows[0].idAleatorio).toBe('RED-9');
      expect(rows[1].idAleatorio).toBe('ACC-9');
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

    it('usa la cadena de fallback de dni desde lealData cuando no hay dto', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({
          payments: [
            { method: 'EFECTIVO', code: '01', amount: 10, lealData: { uid: '', cedula: 'CED-9' } },
          ],
        }),
        'TX1',
        [{ puntos: 10, puntosActivos: 5, idTransaccionLeal: 'R1' }],
        { puntos: 20, puntosActivos: 15, idTransaccionLeal: 'A1' },
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows[0].dni).toBe('CED-9');
      expect(rows[1].dni).toBe('CED-9');
    });

    it('usa customerDocumentId y customerName como fallback cuando no hay cedula', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({
          payments: [
            { method: 'EFECTIVO', code: '01', amount: 10, lealData: { uid: '', customerDocumentId: 'DOC-1', customerName: 'Juan' } },
          ],
        }),
        'TX1',
        [{ puntos: 10, puntosActivos: 5, idTransaccionLeal: 'R1' }],
        null,
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows[0].dni).toBe('DOC-1');
      expect(rows[0].nombre).toBe('Juan');
    });

    it('usa lealCustomerUid como último fallback de dni en acumulación', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({
          lealCustomerUid: 'UID-7',
          lealCustomerName: 'Nombre Leal',
          payments: [{ method: 'EFECTIVO', code: '01', amount: 10, lealData: { uid: '' } }],
        }),
        'TX1',
        [],
        { puntos: 20, puntosActivos: 15, idTransaccionLeal: 'A1' },
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows[0].dni).toBe('UID-7');
      expect(rows[0].nombre).toBe('Nombre Leal');
    });

    it('usa cadena vacía cuando no hay dni ni lealData', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({ payments: [{ method: 'EFECTIVO', code: '01', amount: 10 }] }),
        'TX1',
        [{ puntos: 10, puntosActivos: 5, idTransaccionLeal: 'R1' }],
        { puntos: 20, puntosActivos: 15, idTransaccionLeal: 'A1' },
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows[0].dni).toBe('');
      expect(rows[0].nombre).toBe('');
      expect(rows[1].dni).toBe('');
    });

    it('usa el dni del dto en el renglón de acumulación', async () => {
      invoiceRepo.insertLealTransactions.mockResolvedValue(undefined);

      await processor.persistTransactions(
        baseDto({
          lealCustomerDni: '0801-XYZ',
          payments: [{ method: 'EFECTIVO', code: '01', amount: 10 }],
        }),
        'TX1',
        [],
        { puntos: 20, puntosActivos: 15, idTransaccionLeal: 'A1' },
      );

      const rows = invoiceRepo.insertLealTransactions.mock.calls[0][0];
      expect(rows[0].dni).toBe('0801-XYZ');
    });
  });

  describe('reverseForCreditNote', () => {
    it('revierte cada línea con id aleatorio', async () => {
      invoiceQueryRepo.getInvoiceLines.mockResolvedValue([
        { IDAleatorio: 'A1', IdTransaccionLeal: 11 },
        { IDAleatorio: null, IdTransaccionLeal: 22 },
      ] as never);

      await processor.reverseForCreditNote('TX1');

      expect(lealRepo.reverseTransaction).toHaveBeenCalledTimes(1);
      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith('11', 'A1', '');
    });

    it('captura errores de reversión', async () => {
      invoiceQueryRepo.getInvoiceLines.mockResolvedValue([
        { IDAleatorio: 'A1', IdTransaccionLeal: 11 },
      ] as never);
      lealRepo.reverseTransaction.mockRejectedValue(new Error('leal'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await expect(
        processor.reverseForCreditNote('TX1'),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('usa cadena vacía si falta IdTransaccionLeal', async () => {
      invoiceQueryRepo.getInvoiceLines.mockResolvedValue([
        { IDAleatorio: 'A1', IdTransaccionLeal: undefined },
      ] as never);
      lealRepo.reverseTransaction.mockResolvedValue(undefined);

      await processor.reverseForCreditNote('TX1');

      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith('', 'A1', '');
    });
  });

  describe('compensate', () => {
    it('revierte cada redención y la acumulación', async () => {
      lealRepo.reverseTransaction.mockResolvedValue(undefined);

      await processor.compensate({
        redemptions: [
          { puntos: 1, puntosActivos: 1, idTransaccionLeal: 'R1' },
        ],
        accumulationResult: {
          puntos: 2,
          puntosActivos: 1,
          idTransaccionLeal: 'A1',
        },
        lealIdAleatorioRed: 'RED-1',
        lealIdAleatorioAcum: 'ACC-1',
        predictedInvoiceNo: 'FAC-1',
      });

      expect(lealRepo.reverseTransaction).toHaveBeenNthCalledWith(
        1,
        'R1',
        'RED-1',
        '',
      );
      expect(lealRepo.reverseTransaction).toHaveBeenNthCalledWith(
        2,
        'A1',
        'ACC-1',
        '',
      );
    });

    it('salta redenciones sin id de transacción', async () => {
      await processor.compensate({
        redemptions: [
          { puntos: 1, puntosActivos: 1, idTransaccionLeal: '' },
          { puntos: 1, puntosActivos: 1, idTransaccionLeal: 'R2' },
        ],
        accumulationResult: null,
        predictedInvoiceNo: 'FAC-1',
      });

      expect(lealRepo.reverseTransaction).toHaveBeenCalledTimes(1);
      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith('R2', 'FAC-1', '');
    });

    it('usa el id aleatorio acumulado si no se provee lealIdAleatorioAcum', async () => {
      await processor.compensate({
        redemptions: [],
        accumulationResult: {
          puntos: 2,
          puntosActivos: 1,
          idTransaccionLeal: 'A1',
        },
        predictedInvoiceNo: 'FAC-1',
      });

      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith('A1', '', '');
    });

    it('captura errores de reversión sin lanzar', async () => {
      lealRepo.reverseTransaction.mockRejectedValue(new Error('leal down'));

      await expect(
        processor.compensate({
          redemptions: [
            { puntos: 1, puntosActivos: 1, idTransaccionLeal: 'R1' },
          ],
          accumulationResult: null,
          predictedInvoiceNo: 'FAC-1',
        }),
      ).resolves.toBeUndefined();
    });

    it('captura errores de reversión de la acumulación sin lanzar', async () => {
      lealRepo.reverseTransaction
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('leal down'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await expect(
        processor.compensate({
          redemptions: [
            { puntos: 1, puntosActivos: 1, idTransaccionLeal: 'R1' },
          ],
          accumulationResult: {
            puntos: 2,
            puntosActivos: 1,
            idTransaccionLeal: 'A1',
          },
          predictedInvoiceNo: 'FAC-1',
        }),
      ).resolves.toBeUndefined();
      expect(lealRepo.reverseTransaction).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });
});

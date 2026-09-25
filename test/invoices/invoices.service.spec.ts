import { Test } from '@nestjs/testing';
import { InvoicesService } from '../../src/application/services/invoices.service';
import { DispensersService } from '../../src/application/services/dispensers.service';
import { CampanasService } from '../../src/application/services/campanas.service';
import { InvoiceLealProcessor } from '../../src/application/services/invoice-leal.processor';
import { ValidateAdminUseCase } from '../../src/application/use-cases/auth/validate-admin.use-case';
import type { CreditNoteInput } from '../../src/domain/entities/invoice.entity';
import {
  NotFoundDomainError,
  ConflictDomainError,
} from '../../src/domain/errors/domain-error';
import type { InvoiceQueryRepository } from '../../src/domain/ports/out/invoice-query-repository.interface';
import type { InvoiceRepository } from '../../src/domain/ports/out/invoice-repository.interface';
import type { DispenserRepository } from '../../src/domain/ports/out/dispenser-repository.interface';
import type { StoreConfigRepository } from '../../src/domain/ports/out/store-config-repository.interface';
import type { LealRepository } from '../../src/domain/ports/out/leal-repository.interface';
import type { CreateInvoiceDto } from '../../src/infrastructure/web/dto/invoice/create-invoice.dto';

const baseDto = (): CreateInvoiceDto => ({
  storeId: '001',
  posNo: 'POS01',
  shiftNumber: '1',
  customerNo: 'C1',
  customerName: 'Cliente',
  customerRtn: 'RTN1',
  shiftDate: '2026-08-15',
  employeeName: 'John',
  items: [
    {
      code: 'P1',
      description: 'Producto 1',
      qty: 2,
      price: 100,
      tax: 30,
      discount: 0,
      total: 200,
    },
  ],
  payments: [{ method: 'EFECTIVO', code: 'CASH', amount: 200 }],
  total: 200,
  tax: 30,
  discount: 0,
});

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let invoiceQueryRepo: jest.Mocked<InvoiceQueryRepository>;
  let dispenserRepo: jest.Mocked<DispenserRepository>;
  let storeConfigRepo: jest.Mocked<StoreConfigRepository>;
  let lealRepo: jest.Mocked<LealRepository>;
  let dispensersService: { clearPumpSale: jest.Mock };
  let campanasService: { evaluateCampanas: jest.Mock };

  beforeEach(async () => {
    invoiceRepo = {
      executeInvoiceInsert: jest.fn(),
      executeCreditNote: jest.fn(),
      insertSalesLine: jest.fn(),
      insertPaymentMethod: jest.fn(),
      insertLealTransactions: jest.fn(),
      creditNote: jest.fn(),
    };
    invoiceQueryRepo = {
      getShiftDetails: jest.fn(),
      findNextCorrelative: jest.fn(),
      validateCorrelative: jest.fn().mockResolvedValue({ isValid: true, message: 'ok' }),
      searchInvoices: jest.fn(),
      getInvoiceLines: jest.fn(),
      getInvoicePayments: jest.fn(),
      getInvoiceLealTransactions: jest.fn(),
      getInvoiceCampanas: jest.fn(),
      getReasons: jest.fn(),
      findAll: jest.fn(),
      getOpenShiftForEmployee: jest.fn(),
      getOriginalDocument: jest.fn(),
      checkExistingReversion: jest.fn(),
      findNextCreditNoteCorrelative: jest.fn(),
      findByNo: jest.fn(),
      findStoreConfigField: jest.fn(),
    };
    dispenserRepo = {
      getSaleById: jest.fn(),
      getHoseFsMapping: jest.fn(),
      getItemMetadata: jest.fn(),
      updateSaleInvoiced: jest.fn(),
      reverseFusionSale: jest.fn(),
      renewTransactions: jest.fn(),
    } as unknown as jest.Mocked<DispenserRepository>;
    storeConfigRepo = {
      findByStoreId: jest.fn(),
      findTasaByGrupo: jest.fn().mockResolvedValue(15),
    } as unknown as jest.Mocked<StoreConfigRepository>;
    lealRepo = {
      redeemPoints: jest.fn(),
      accumulatePoints: jest.fn(),
      reverseTransaction: jest.fn(),
    } as unknown as jest.Mocked<LealRepository>;
    dispensersService = { clearPumpSale: jest.fn() };
    campanasService = { evaluateCampanas: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        InvoiceLealProcessor,
        { provide: 'InvoiceRepository', useValue: invoiceRepo },
        { provide: 'InvoiceQueryRepository', useValue: invoiceQueryRepo },
        { provide: 'DispenserRepository', useValue: dispenserRepo },
        { provide: 'StoreConfigRepository', useValue: storeConfigRepo },
        { provide: 'LealRepository', useValue: lealRepo },
        { provide: DispensersService, useValue: dispensersService },
        { provide: CampanasService, useValue: campanasService },
        { provide: ValidateAdminUseCase, useValue: { execute: jest.fn().mockResolvedValue({ valid: true }) } },
      ],
    }).compile();

    service = module.get(InvoicesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createInvoice', () => {
    it('inserta factura simple y devuelve correlativo de la DB', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'DB Emp',
        shiftId: null,
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-001-POS01-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        {
          NextInvoiceOfNextInvoice: 'FAC-001-POS01-123456',
          NextPosTransactionIDNumber: 'PTX-9',
          CAIOfNextInvoice: 'CAI-1',
          StartingNoOfNextInvoice: '0001',
          EndingNoOfNextInvoice: '9999',
          FechaVenceRangoOfNextInvoice: new Date('2027-01-01'),
        },
      ]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);

      const result = await service.createInvoice(baseDto());

      expect(invoiceQueryRepo.getShiftDetails).toHaveBeenCalledWith(
        '001',
        'POS01',
        '1',
        'John',
      );
      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: '001',
          lines: expect.arrayContaining([
            expect.objectContaining({
              itemCode: 'P1',
              quantity: 2,
              vatPercent: 0,
            }),
          ]),
          payments: expect.arrayContaining([
            expect.objectContaining({ description: 'EFECTIVO' }),
          ]),
        }),
      );
      expect(result).toMatchObject({
        success: true,
        invoiceNo: 'FAC-001-POS01-123456',
        posTransactionId: 'PTX-9',
        cai: 'CAI-1',
        startingNo: '0001',
        endingNo: '9999',
      });
      expect(result.fechaVence).toBeTruthy();
    });

    it('rellena vacíos cuando el DTO trae campos opcionales undefined', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'DB Emp',
        shiftId: null,
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        {
          NextInvoiceOfNextInvoice: 'FAC-001-POS01-123456',
          NextPosTransactionIDNumber: 'PTX-9',
          CAIOfNextInvoice: 'CAI-1',
          StartingNoOfNextInvoice: '0001',
          EndingNoOfNextInvoice: '9999',
          FechaVenceRangoOfNextInvoice: new Date('2027-01-01'),
        },
      ]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);

      const dto = baseDto();
      delete (dto as any).customerRtn;
      delete (dto as any).km;
      delete (dto as any).orden;
      delete (dto as any).placa;
      delete (dto as any).chofer;
      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          customerRtn: '',
          km: '',
          orden: '',
          placa: '',
          chofer: '',
        }),
      );
    });

    it('usa employeeName de la DB como fallback', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'DB Emp',
        shiftId: null,
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        { NextInvoiceOfNextInvoice: 'FAC-001-POS01-1' },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.employeeName = '';

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({ employeeName: 'DB Emp' }),
      );
    });

    it('genera factura por defecto cuando el insert no devuelve filas', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);

      const result = await service.createInvoice(baseDto());

      expect(result.invoiceNo).toMatch(/^FAC-001-POS01-\d{6}$/);
    });

    it('procesa líneas de combustible con saleId', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        { NextInvoiceOfNextInvoice: 'FAC-001-POS01-1' },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 1,
        HoseNumber: '3',
        amount: 100,
        ppu: 50,
        volume: 2,
        GradeNr: null,
        IsInvoiced: false,
      ShiftId: 20260101,
      });
      dispenserRepo.getHoseFsMapping.mockResolvedValue({
        CodigoPOS: 'SUPER',
        TankIDs: 'T1',
        unidadMedida: 'galones',
      });
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 5 }];

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              itemCode: 'SUPER',
              pumpNo: '1',
              pumpPositionNo: 'C',
              tankNo: 'T1',
              unidadMedida: 'galones',
              turnoControlador: '20260101',
              quantity: 2,
              unitPrice: 50,
              genPumpLedgEntry: 1,
              saleId: '5',
            }),
          ]),
          onCommit: expect.any(Function),
        }),
      );
      // El reclamo de combustible ahora es atómico dentro del tx (no updateSaleInvoiced post-commit)
      expect(dispenserRepo.updateSaleInvoiced).not.toHaveBeenCalled();
    });

    it('compensa Leal si el insert falla tras la redención', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockRejectedValue(
        new Error('constraint'),
      );
      lealRepo.redeemPoints.mockResolvedValue({
        id_transaccion: 'L1',
        puntos_activos: 100,
      });
      const dto = baseDto();
      dto.lealIdAleatorioRed = 'ALEATORIO-RED-1';
      dto.payments = [
        {
          ...dto.payments[0],
          lealData: { uid: 'U1', puntos: 100, idPremio: 5, otp: '1234' },
        } as never,
      ];

      await expect(service.createInvoice(dto)).rejects.toThrow('constraint');

      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith(
        'L1',
        'ALEATORIO-RED-1',
        '',
      );
    });

    it('respeta el monto del controlador en combustible (ppu redondeado)', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        { NextInvoiceOfNextInvoice: 'FAC-001-POS01-1' },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 11,
        HoseNumber: '3',
        amount: 1000,
        ppu: 36.4,
        volume: 27.475,
        GradeNr: null,
        IsInvoiced: false,
      ShiftId: 20260101,
      });
      dispenserRepo.getHoseFsMapping.mockResolvedValue({
        CodigoPOS: 'SUPER',
        TankIDs: 'T1',
        unidadMedida: 'galones',
      });
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 381029 }];

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              saleId: '381029',
              unitPrice: 36.4,
              quantity: 27.475,
              montoGravado: 1000,
              vatAmount: 0,
              amountIncludingVAT: 1000,
            }),
          ]),
          onCommit: expect.any(Function),
        }),
      );
    });

    it('deriva la base gravada del monto del controlador cuando el combustible es gravado', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        { NextInvoiceOfNextInvoice: 'FAC-001-POS01-1' },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 11,
        HoseNumber: '3',
        amount: 1150,
        ppu: 40,
        volume: 25,
        GradeNr: null,
        IsInvoiced: false,
      ShiftId: 20260101,
      });
      dispenserRepo.getHoseFsMapping.mockResolvedValue({
        CodigoPOS: 'SUPER',
        TankIDs: 'T1',
        unidadMedida: 'galones',
      });
      dispenserRepo.getItemMetadata.mockResolvedValue({
        Description: 'GASOLINA SUPER',
        'VAT Prod_ Posting Group': 'ISV15',
        'Item Category Code': 'FUEL',
        'Gen_ Pump Ledg_ Entry': 1,
        UnidadMedida: null,
      });
      (storeConfigRepo.findTasaByGrupo as jest.Mock).mockResolvedValue(15);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 381030 }];

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              saleId: '381030',
              montoGravado: 1000,
              vatAmount: 150,
              amountIncludingVAT: 1150,
            }),
          ]),
          onCommit: expect.any(Function),
        }),
      );
    });

    it('usa HoseNumber literal fuera del rango válido', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 1,
        HoseNumber: '30',
        amount: 100,
        ppu: 50,
        volume: 2,
        GradeNr: null,
        IsInvoiced: false,
      ShiftId: 20260101,
      });
      dispenserRepo.getHoseFsMapping.mockResolvedValue(null);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 5 }];

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({ pumpPositionNo: '30', itemCode: 'P1' }),
          ]),
        }),
      );
    });

    it('lanza si la transacción de combustible no existe', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      dispenserRepo.getSaleById.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 99 }];

      await expect(service.createInvoice(dto)).rejects.toThrow(
        'No se encontró la transacción de combustible #99',
      );
    });

    it('lanza NotFoundDomainError si no se encuentra la transacción', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      dispenserRepo.getSaleById.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 99 }];

      await expect(service.createInvoice(dto)).rejects.toBeInstanceOf(
        NotFoundDomainError,
      );
    });

    it('lanza si la transacción ya fue facturada', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 1,
        HoseNumber: '1',
        amount: 100,
        ppu: 50,
        volume: 2,
        GradeNr: null,
        IsInvoiced: true,
      ShiftId: null,
      });
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 5 }];

      await expect(service.createInvoice(dto)).rejects.toThrow(
        'ya fue facturada anteriormente',
      );
    });

    it('lanza ConflictDomainError si la transacción ya fue facturada', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 1,
        HoseNumber: '1',
        amount: 100,
        ppu: 50,
        volume: 2,
        GradeNr: null,
        IsInvoiced: true,
      ShiftId: null,
      });
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 5 }];

      await expect(service.createInvoice(dto)).rejects.toBeInstanceOf(
        ConflictDomainError,
      );
    });

    it('factura un saleId pendiente del controlador aunque exista un id_venta viejo en las líneas', async () => {
      // Escenario: controlador sustituido. El saleId del controlador actual está
      // pendiente (IsInvoiced=false), pero en lineas_venta existe un id_venta igual
      // (de un controlador anterior). La validación es SOLO contra fusion_sales
      // (getSaleById/IsInvoiced), no contra las líneas del POS.
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        { NextInvoiceOfNextInvoice: 'FAC-001-POS01-1' },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getSaleById.mockResolvedValue({
        PumpNumber: 1,
        HoseNumber: '1',
        amount: 100,
        ppu: 50,
        volume: 2,
        GradeNr: null,
        IsInvoiced: false,
      ShiftId: 20260101,
      });
      dispenserRepo.getHoseFsMapping.mockResolvedValue({
        CodigoPOS: 'SUPER',
        TankIDs: 'T1',
        unidadMedida: 'galones',
      });
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], saleId: 5 }];

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalled();
    });

    it('deriva ISV 15% desde el grupo del artículo', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue({
        Description: 'Nuevo',
        'VAT Prod_ Posting Group': 'ISV_15',
        'Item Category Code': 'CAT',
        'Gen_ Pump Ledg_ Entry': 1,
        UnidadMedida: 'UND',
      });

      await service.createInvoice(baseDto());

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              description: 'Nuevo',
              vatPercent: 15,
              vatProdPostingGroup: 'ISV_15',
              genPumpLedgEntry: 1,
              unidadMedida: 'UND',
            }),
          ]),
        }),
      );
    });

    it('clasifica métodos de pago', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.payments = [
        {
          method: 'TARJETA BAC',
          code: 'V',
          amount: 10,
          reference: '1234567890123456789012345',
        },
        { method: 'LEAL', code: 'L', amount: 5, lealData: undefined },
        { method: 'CREDITO', code: 'C', amount: 3 },
        { method: 'OTRO', code: 'O', amount: 1 },
      ];

      await service.createInvoice(dto);

      expect(invoiceRepo.executeInvoiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          payments: expect.arrayContaining([
            expect.objectContaining({
              description: 'TARJETA',
              reference: '12345678901234567890',
            }),
            expect.objectContaining({ description: 'LEAL', reference: '' }),
            expect.objectContaining({ description: 'CREDITO' }),
            expect.objectContaining({ description: 'EFECTIVO' }),
          ]),
        }),
      );
    });

    it('redime puntos Leal y persiste la transacción', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-001-POS01-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        {
          NextInvoiceOfNextInvoice: 'FAC-1',
          NextPosTransactionIDNumber: 'PTX-9',
        },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      lealRepo.redeemPoints.mockResolvedValue({
        puntos_activos: 100,
        id_transaccion: 'LEAL-1',
      });
      const dto = baseDto();
      dto.payments = [
        {
          method: 'LEAL',
          code: 'L',
          amount: 10,
          lealData: { uid: 'U1', puntos: 10, otp: '1234', idPremio: 7 },
        },
      ];
      dto.lealIdAleatorioRed = 'RED-1';

      const result = await service.createInvoice(dto);

      expect(lealRepo.redeemPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'U1',
          points: 10,
          invoiceNo: 'RED-1',
          otp: '1234',
        }),
      );
      const onCommit = (invoiceRepo.executeInvoiceInsert as any).mock.calls.at(-1)[0]
        .onCommit;
      const txMock = { ventaLeal: { create: jest.fn().mockResolvedValue({}) } };
      await onCommit(txMock, 'PTX-9');
      expect(txMock.ventaLeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idTransaccionPos: 'PTX-9',
            idTransaccionLeal: 'LEAL-1',
            puntos: 10,
            puntosActivos: 100,
            tipo: 1,
          }),
        }),
      );
      expect(result.lealReprintMessage).toContain('Puntos Redimidos: 10');
    });

    it('acumula puntos Leal excluyendo LEAL/CREDITO/CALIBRACION', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        {
          NextInvoiceOfNextInvoice: 'FAC-1',
          NextPosTransactionIDNumber: 'PTX-9',
        },
      ] as never);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      lealRepo.accumulatePoints.mockResolvedValue({
        puntos: 5,
        puntos_activos: 50,
        id_transaccion: 'LEAL-A',
      });
      const dto = baseDto();
      dto.lealCustomerUid = 'U1';
      dto.lealIdAleatorioAcum = 'ACUM-1';
      dto.payments = [
        { method: 'EFECTIVO', code: 'CASH', amount: 100 },
        { method: 'LEAL', code: 'L', amount: 50 },
      ];

      const result = await service.createInvoice(dto);

      expect(lealRepo.accumulatePoints).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'U1',
          invoiceNo: 'FAC-1',
          noFactura: 'ACUM-1',
          total: 100,
        }),
      );
      const onCommit = (invoiceRepo.executeInvoiceInsert as any).mock.calls.at(-1)[0]
        .onCommit;
      const txMock = { ventaLeal: { create: jest.fn().mockResolvedValue({}) } };
      await onCommit(txMock, 'PTX-9');
      expect(txMock.ventaLeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idTransaccionPos: 'PTX-9',
            idTransaccionLeal: 'LEAL-A',
            puntos: 5,
            puntosActivos: 50,
            tipo: 0,
          }),
        }),
      );
      expect(result.lealReprintMessage).toContain('Puntos Acumulados: 5');
    });

    it('no bloquea la venta si falla la acumulación Leal', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      lealRepo.accumulatePoints.mockRejectedValue(new Error('leal down'));
      const dto = baseDto();
      dto.lealCustomerUid = 'U1';
      dto.lealIdAleatorioAcum = 'ACUM-1';

      const result = await service.createInvoice(dto);

      expect(result.success).toBe(true);
      expect(result.lealReprintMessage).toContain(
        'No se pudo acumular en Leal',
      );
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('limpia ventas de bomba para códigos GAS-', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([]);
      campanasService.evaluateCampanas.mockResolvedValue([]);
      dispenserRepo.getItemMetadata.mockResolvedValue(null);
      const dto = baseDto();
      dto.items = [{ ...dto.items[0], code: 'GAS-3' }];

      await service.createInvoice(dto);

      expect(dispensersService.clearPumpSale).toHaveBeenCalledWith(3);
      expect(dispenserRepo.updateSaleInvoiced).not.toHaveBeenCalled();
    });

    it('ignora errores de campanas', async () => {
      invoiceQueryRepo.getShiftDetails.mockResolvedValue({
        shiftDate: new Date('2026-08-15'),
        employeeName: 'John',
        shiftId: 'SHIFT1',
      });
      invoiceQueryRepo.findNextCorrelative.mockResolvedValue({
        invoiceNo: 'FAC-1',
        posTransactionId: 'PT1',
      });
      invoiceRepo.executeInvoiceInsert.mockResolvedValue([
        { NextPosTransactionIDNumber: 'PTX-9' },
      ] as never);
      campanasService.evaluateCampanas.mockRejectedValue(
        new Error('campanas down'),
      );
      dispenserRepo.getItemMetadata.mockResolvedValue(null);

      const result = await service.createInvoice(baseDto());

      expect(result.success).toBe(true);
      expect(result.campanaTickets).toEqual([]);
    });
  });

  describe('métodos de consulta', () => {
    it('validateCorrelative delega', async () => {
      invoiceQueryRepo.validateCorrelative.mockResolvedValue({
        isValid: true,
        message: 'ok',
      });

      await expect(
        service.validateCorrelative('001', 'POS01', true),
      ).resolves.toEqual({
        isValid: true,
        message: 'ok',
      });
    });

    it('searchInvoices delega', async () => {
      invoiceQueryRepo.searchInvoices.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.searchInvoices('001', true, 'POS01'),
      ).resolves.toEqual([{ id: 1 }]);
      expect(invoiceQueryRepo.searchInvoices).toHaveBeenCalledWith({
        storeId: '001',
        avanzado: true,
        posNo: 'POS01',
        turno: undefined,
        fechaTurno: undefined,
        fechaDesde: undefined,
        fechaHasta: undefined,
        factura: undefined,
        customerName: undefined,
        employeeName: undefined,
      });
    });

    it('getInvoiceLines, getInvoicePayments, getInvoiceCampanas, getReasons, getInvoices delegan', async () => {
      invoiceQueryRepo.getInvoiceLines.mockResolvedValue([{ line: 1 }]);
      invoiceQueryRepo.getInvoicePayments.mockResolvedValue([{ pay: 1 }]);
      invoiceQueryRepo.getInvoiceCampanas.mockResolvedValue([
        { campanaId: 1 },
      ] as never);
      invoiceQueryRepo.getReasons.mockResolvedValue([{ Id_motivo: 1, motivo: 'x' }]);
      invoiceQueryRepo.findAll.mockResolvedValue([{ inv: 1 }]);

      await expect(service.getInvoiceLines('T')).resolves.toEqual([
        { line: 1 },
      ]);
      await expect(service.getInvoicePayments('T')).resolves.toEqual([
        { pay: 1 },
      ]);
      await expect(service.getInvoiceCampanas('T')).resolves.toEqual([
        { campanaId: 1 },
      ]);
      await expect(service.getReasons()).resolves.toEqual([
        { Id_motivo: 1, motivo: 'x' },
      ]);
      await expect(service.getInvoices()).resolves.toEqual([{ inv: 1 }]);
    });

    it('getInvoiceLealMessage arma mensaje por tipo', async () => {
      invoiceQueryRepo.getInvoiceLealTransactions.mockResolvedValue([
        { Tipo: 1, Puntos: 10, PuntosActivos: 100 },
        { Tipo: 0, Puntos: 5, PuntosActivos: 50 },
      ]);

      const result = await service.getInvoiceLealMessage('T');

      expect(result.lealReprintMessage).toContain(
        'Puntos Redimidos: 10 | Puntos Activos: 100',
      );
      expect(result.lealReprintMessage).toContain(
        'Puntos Acumulados: 5 | Puntos Activos: 50',
      );
    });

    it('getInvoiceLealMessage devuelve vacío sin registros', async () => {
      invoiceQueryRepo.getInvoiceLealTransactions.mockResolvedValue([]);

      await expect(service.getInvoiceLealMessage('T')).resolves.toEqual({
        lealReprintMessage: '',
      });
    });

    it('getInvoiceLealMessage devuelve vacío si el repo falla', async () => {
      invoiceQueryRepo.getInvoiceLealTransactions.mockRejectedValue(new Error('x'));

      await expect(service.getInvoiceLealMessage('T')).resolves.toEqual({
        lealReprintMessage: '',
      });
    });

    it('renewTransactions devuelve filas afectadas', async () => {
      dispenserRepo.renewTransactions.mockResolvedValue(3);

      await expect(service.renewTransactions()).resolves.toEqual({
        success: true,
        rowsAffected: 3,
      });
    });
  });

  describe('processCreditNote', () => {
    const user = {
      storeId: '001',
      posNo: 'POS01',
      username: 'jdoe',
      name: 'jdoe',
    };
    const dto = {
      invoiceNo: 'FAC-1',
      transactionId: 'T1',
      reason: 'Error',
      storeId: '001',
      posNo: 'POS01',
      username: 'jdoe',
      adminPassword: 'secret',
    } as never;

    it('lanza si no hay turno abierto', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue(null);

      await expect(service.processCreditNote(dto, user)).rejects.toThrow(
        'No tiene un turno abierto',
      );
    });

    it('rechaza sin password de admin', async () => {
      await expect(
        service.processCreditNote(
          { ...(dto as object), adminPassword: '' } as CreditNoteInput,
          user,
        ),
      ).rejects.toThrow('contraseña de administrador');
    });

    it('rechaza con password de admin inválido', async () => {
      (service as any).validateAdminUseCase.execute.mockRejectedValueOnce(
        new Error('bad'),
      );
      await expect(service.processCreditNote(dto, user)).rejects.toThrow(
        'Contraseña de administrador inválida',
      );
    });

    it('lanza si no se encuentra el documento original', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date(),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue(null);

      await expect(service.processCreditNote(dto, user)).rejects.toThrow(
        'No se encontró el documento original',
      );
    });

    it('solo permite anular documentos tipo 1 o 2', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date(),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue({
        'POS Sales Doc_ Type': 3,
      });

      await expect(service.processCreditNote(dto, user)).rejects.toThrow(
        'Solo se puede hacer devolucion de facturas',
      );
    });

    it('lanza si la factura ya tiene nota de crédito', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date(),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue({
        'POS Sales Doc_ Type': 1,
      });
      invoiceQueryRepo.checkExistingReversion.mockResolvedValue(true);

      await expect(service.processCreditNote(dto, user)).rejects.toThrow(
        'ya tiene una Nota de Crédito',
      );
    });

    it('ejecuta la nota de crédito y revierte líneas de combustible', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date('2026-08-15T06:00:00'),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue({
        'POS Sales Doc_ Type': 1,
        'Customer No_': 'C1',
        'Cust_ Name': 'Cliente',
        'VAT Reg_ No_': 'RTN',
        Amount: 200,
        SubTotal: 180,
        'Billing Type': 1,
        KM: '',
        Orden: '',
        Placa: '',
        Chofer: '',
        Cambio: 0,
      });
      invoiceQueryRepo.checkExistingReversion.mockResolvedValue(false);
      invoiceQueryRepo.findNextCreditNoteCorrelative.mockResolvedValue({
        serieCode: 'NC',
        nextInvoice: 'NC-1',
        remainingInvoices: 100,
        remainingDays: 10,
      });
      storeConfigRepo.findByStoreId.mockResolvedValue({
        isLealEnabled: false,
      } as never);
      invoiceRepo.executeCreditNote.mockResolvedValue({
        nextPosTransactionId: 'NC1',
        finalInvoiceNo: 'NC-1',
      });
      invoiceQueryRepo.getInvoiceLines.mockResolvedValue([
        { SaleID: '5', IDAleatorio: null, IdTransaccionLeal: null },
      ]);
      invoiceQueryRepo.getInvoicePayments.mockResolvedValue([{ Amount: 200 }]);

      const result = await service.processCreditNote(dto, user);

      expect(invoiceRepo.executeCreditNote).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -200,
          subTotal: -180,
          invoiceNo: 'FAC-1',
          reason: 'Error',
        }),
      );
      expect(invoiceRepo.insertSalesLine).toHaveBeenCalled();
      expect(dispenserRepo.reverseFusionSale).toHaveBeenCalledWith('5');
      expect(invoiceRepo.insertPaymentMethod).toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        creditNoteNo: 'NC-1',
      });
    });

    it('anula transacciones Leal cuando Leal está activo', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date(),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue({
        'POS Sales Doc_ Type': 2,
      });
      invoiceQueryRepo.checkExistingReversion.mockResolvedValue(false);
      invoiceQueryRepo.findNextCreditNoteCorrelative.mockResolvedValue({
        serieCode: 'NC',
        nextInvoice: 'NC-1',
        remainingInvoices: 100,
        remainingDays: 10,
      });
      storeConfigRepo.findByStoreId.mockResolvedValue({
        isLealEnabled: true,
      } as never);
      invoiceRepo.executeCreditNote.mockResolvedValue({
        nextPosTransactionId: 'NC1',
        finalInvoiceNo: 'NC-1',
      });
      invoiceQueryRepo.getInvoiceLines
        .mockResolvedValueOnce([
          { IDAleatorio: 'R1', IdTransaccionLeal: 'L1', SaleID: null },
        ])
        .mockResolvedValueOnce([]);
      invoiceQueryRepo.getInvoicePayments.mockResolvedValue([]);
      lealRepo.reverseTransaction.mockResolvedValue({});

      await service.processCreditNote(dto, user);

      expect(lealRepo.reverseTransaction).toHaveBeenCalledWith('L1', 'R1', '');
    });

    it('continúa si falla la reversión Leal', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date(),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue({
        'POS Sales Doc_ Type': 1,
      });
      invoiceQueryRepo.checkExistingReversion.mockResolvedValue(false);
      invoiceQueryRepo.findNextCreditNoteCorrelative.mockResolvedValue({
        serieCode: 'NC',
        nextInvoice: 'NC-1',
        remainingInvoices: 100,
        remainingDays: 10,
      });
      storeConfigRepo.findByStoreId.mockResolvedValue({
        isLealEnabled: true,
      } as never);
      invoiceRepo.executeCreditNote.mockResolvedValue({
        nextPosTransactionId: 'NC1',
        finalInvoiceNo: 'NC-1',
      });
      invoiceQueryRepo.getInvoiceLines
        .mockResolvedValueOnce([
          { IDAleatorio: 'R1', IdTransaccionLeal: 'L1', SaleID: null },
        ])
        .mockResolvedValueOnce([]);
      invoiceQueryRepo.getInvoicePayments.mockResolvedValue([]);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      lealRepo.reverseTransaction.mockRejectedValue(new Error('leal down'));

      const result = await service.processCreditNote(dto, user);

      expect(result.success).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('continúa aunque falle la consulta de config Leal', async () => {
      invoiceQueryRepo.getOpenShiftForEmployee.mockResolvedValue({
        'Shift Starting': new Date(),
        EmployeeName: 'jdoe',
        Shift: '1',
        'POS Transaction ID': 'T1',
      });
      invoiceQueryRepo.getOriginalDocument.mockResolvedValue({
        'POS Sales Doc_ Type': 1,
      });
      invoiceQueryRepo.checkExistingReversion.mockResolvedValue(false);
      invoiceQueryRepo.findNextCreditNoteCorrelative.mockResolvedValue({
        serieCode: 'NC',
        nextInvoice: 'NC-1',
        remainingInvoices: 100,
        remainingDays: 10,
      });
      storeConfigRepo.findByStoreId.mockRejectedValue(new Error('config down'));
      invoiceRepo.executeCreditNote.mockResolvedValue({
        nextPosTransactionId: 'NC1',
        finalInvoiceNo: 'NC-1',
      });
      invoiceQueryRepo.getInvoiceLines.mockResolvedValue([]);
      invoiceQueryRepo.getInvoicePayments.mockResolvedValue([]);

      const result = await service.processCreditNote(dto, user);

      expect(result.success).toBe(true);
    });
  });
});

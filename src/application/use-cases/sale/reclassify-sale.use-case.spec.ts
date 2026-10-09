import { Test, TestingModule } from '@nestjs/testing';
import { ReclassifySaleUseCase } from './reclassify-sale.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValidateAdminUseCase } from '../auth/validate-admin.use-case';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('ReclassifySaleUseCase', () => {
  let useCase: ReclassifySaleUseCase;
  let prisma: any;
  let validateAdminUseCase: any;

  beforeEach(async () => {
    prisma = {
      venta: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      pagoVenta: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      turno: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      registroTransaccion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      ventaReclasificacion: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    validateAdminUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReclassifySaleUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: ValidateAdminUseCase, useValue: validateAdminUseCase },
      ],
    }).compile();

    useCase = module.get<ReclassifySaleUseCase>(ReclassifySaleUseCase);
  });

  it('should throw UnauthorizedException if admin pin is invalid', async () => {
    validateAdminUseCase.execute.mockRejectedValue(new Error('Invalid pin'));

    await expect(
      useCase.execute({
        saleId: 'TX-101',
        storeId: '001',
        posNo: '01',
        adminPin: '9999',
        requestedByUser: 'cajero1',
        motivo: 'Error de cobro',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw BadRequestException if motivo is empty', async () => {
    validateAdminUseCase.execute.mockResolvedValue({ valid: true });

    await expect(
      useCase.execute({
        saleId: 'TX-101',
        storeId: '001',
        posNo: '01',
        adminPin: '1234',
        requestedByUser: 'cajero1',
        motivo: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if sale is credit sale (tipoFacturacion = 2)', async () => {
    validateAdminUseCase.execute.mockResolvedValue({ valid: true });
    prisma.venta.findFirst.mockResolvedValue({
      idTransaccionPos: 'TX-101',
      tipoFacturacion: 2,
      pagosVenta: [],
    });

    await expect(
      useCase.execute({
        saleId: 'TX-101',
        storeId: '001',
        posNo: '01',
        adminPin: '1234',
        requestedByUser: 'cajero1',
        motivo: 'Reclasificar crédito',
        nuevoMetodoPago: { codigoMetodoPago: '01' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if associated shift is closed', async () => {
    validateAdminUseCase.execute.mockResolvedValue({ valid: true });
    prisma.venta.findFirst.mockResolvedValue({
      idTransaccionPos: 'TX-101',
      idTurno: 'SHIFT-01',
      tipoFacturacion: 1,
      monto: 500,
      pagosVenta: [],
    });
    prisma.turno.findUnique.mockResolvedValue({
      idTransaccionPos: 'SHIFT-01',
      finTurno: new Date(), // cerrado
      version: 1,
    });

    await expect(
      useCase.execute({
        saleId: 'TX-101',
        storeId: '001',
        posNo: '01',
        adminPin: '1234',
        requestedByUser: 'cajero1',
        motivo: 'Error en método',
        nuevoMetodoPago: { codigoMetodoPago: '02' },
      }),
    ).rejects.toThrow('El turno asociado a esta venta ya se encuentra cerrado');
  });

  it('should successfully reclassify payment and update open shift totals and log audit', async () => {
    validateAdminUseCase.execute.mockResolvedValue({ valid: true });
    prisma.venta.findFirst.mockResolvedValue({
      numeroEmisor: '001',
      idTransaccionPos: 'TX-101',
      idTienda: '001',
      codigoPos: '01',
      idTurno: 'SHIFT-01',
      tipoFacturacion: 1,
      tipoDocumento: 1,
      monto: 1200,
      codigoCliente: '0',
      nombreCliente: 'Consumidor Final',
      rtnCliente: null,
      pagosVenta: [
        {
          numeroLineaPago: 1,
          codigoMetodoPago: '01',
          monto: 1200,
        },
      ],
    });
    prisma.turno.findUnique.mockResolvedValue({
      idTransaccionPos: 'SHIFT-01',
      inicioTurno: new Date('2026-10-08T08:00:00Z'),
      finTurno: null, // abierto
      turno: '1',
      version: 1,
      detallePagos: { '01': 1200 },
    });

    prisma.registroTransaccion.findMany.mockResolvedValue([
      { idTransaccionPos: 'TX-101' },
    ]);
    prisma.venta.findMany.mockResolvedValue([{ monto: 1200 }]);
    prisma.pagoVenta.findMany.mockResolvedValue([
      { codigoMetodoPago: '02', monto: 1200 },
    ]);

    const result = await useCase.execute({
      saleId: 'TX-101',
      storeId: '001',
      posNo: '01',
      adminPin: '1234',
      requestedByUser: 'cajero1',
      supervisorUser: 'admin1',
      motivo: 'Cajero cobró con tarjeta pero marcó efectivo',
      nuevoMetodoPago: {
        codigoMetodoPago: '02',
        descripcion: 'TARJETA',
        referencia: 'VOUCHER-999',
      },
    });

    expect(result.success).toBe(true);
    expect(result.versionTurno).toBe(1);
    expect(prisma.pagoVenta.deleteMany).toHaveBeenCalledWith({
      where: { idTransaccionPos: 'TX-101' },
    });
    expect(prisma.pagoVenta.create).toHaveBeenCalled();
    expect(prisma.ventaReclasificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idVenta: 'TX-101',
          idTurno: 'SHIFT-01',
          versionTurno: 1,
          tipoCambio: 'FORMA_PAGO',
          motivo: 'Cajero cobró con tarjeta pero marcó efectivo',
        }),
      }),
    );
    expect(prisma.turno.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idTransaccionPos: 'SHIFT-01' },
        data: expect.objectContaining({
          importeContado: 1200,
          detallePagos: { '02': 1200 },
        }),
      }),
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ShiftController } from '../../../../src/infrastructure/web/controllers/shift.controller';
import { ShiftService } from '../../../../src/application/services/shift.service';
import { GetShiftStatusUseCase } from '../../../../src/application/use-cases/shift/get-shift-status.use-case';
import { OpenShiftUseCase } from '../../../../src/application/use-cases/shift/open-shift.use-case';
import { CloseShiftUseCase } from '../../../../src/application/use-cases/shift/close-shift.use-case';

describe('ShiftController', () => {
  let controller: ShiftController;
  let shiftService: {
    closeFusionShift: jest.Mock;
    getShiftSalesReport: jest.Mock;
    getAvailableShifts: jest.Mock;
  };
  let getStatus: { execute: jest.Mock };
  let openShift: { execute: jest.Mock };
  let closeShift: { execute: jest.Mock };

  beforeEach(async () => {
    shiftService = {
      closeFusionShift: jest.fn(),
      getShiftSalesReport: jest.fn(),
      getAvailableShifts: jest.fn(),
    };
    getStatus = { execute: jest.fn() };
    openShift = { execute: jest.fn() };
    closeShift = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftController],
      providers: [
        { provide: ShiftService, useValue: shiftService },
        { provide: GetShiftStatusUseCase, useValue: getStatus },
        { provide: OpenShiftUseCase, useValue: openShift },
        { provide: CloseShiftUseCase, useValue: closeShift },
      ],
    }).compile();

    controller = module.get(ShiftController);
  });

  it('getOpenShift usa posNo vacío por defecto', async () => {
    getStatus.execute.mockResolvedValue({ Shift: '1' });

    await controller.getOpenShift('001', 'jdoe');
    expect(getStatus.execute).toHaveBeenCalledWith('001', '', 'jdoe');

    await controller.getOpenShift('001', 'jdoe', '02');
    expect(getStatus.execute).toHaveBeenLastCalledWith('001', '02', 'jdoe');
  });

  it('openShift mapea el DTO al comando', async () => {
    openShift.execute.mockResolvedValue({ success: true });
    const dto = {
      storeId: '001',
      posNo: '01',
      employeeName: 'jdoe',
      initialAmount: 100,
      shiftNumber: '3',
    } as never;

    await controller.openShift(dto);
    expect(openShift.execute).toHaveBeenCalledWith({
      storeId: '001',
      posNo: '01',
      employeeName: 'jdoe',
      initialAmount: 100,
      shiftNumber: '3',
    });
  });

  it('closeShift cierra con actualAmount 0', async () => {
    closeShift.execute.mockResolvedValue(undefined);

    await expect(
      controller.closeShift({
        storeId: '001',
        posNo: '01',
        employeeName: 'jdoe',
      } as never),
    ).resolves.toEqual({ success: true });
    expect(closeShift.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actualAmount: 0 }),
    );
  });

  it('closeFusionShift delega en el service', async () => {
    shiftService.closeFusionShift.mockResolvedValue({ success: true });

    await controller.closeFusionShift({ storeId: '001' } as never);
    expect(shiftService.closeFusionShift).toHaveBeenCalled();
  });

  it('getShiftSalesReport y getAvailableShifts delegan', async () => {
    shiftService.getShiftSalesReport.mockResolvedValue({ totales: {} });
    shiftService.getAvailableShifts.mockResolvedValue([]);

    await controller.getShiftSalesReport(
      '001',
      '01',
      'jdoe',
      '1',
      '2026-08-15',
    );
    expect(shiftService.getShiftSalesReport).toHaveBeenCalledWith(
      '001',
      '01',
      'jdoe',
      '1',
      '2026-08-15',
    );

    await controller.getAvailableShifts('001', '01', '2026-08-15');
    expect(shiftService.getAvailableShifts).toHaveBeenCalledWith(
      '001',
      '01',
      '2026-08-15',
    );

    shiftService.getShiftReclassifications = jest.fn().mockResolvedValue([
      { id: 'REC-1', idVenta: 'TX-1' },
    ]);
    const reclass = await controller.getShiftReclassifications('TX-SHIFT-1');
    expect(shiftService.getShiftReclassifications).toHaveBeenCalledWith('TX-SHIFT-1');
    expect(reclass).toHaveLength(1);
  });
});

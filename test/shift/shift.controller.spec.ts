import { Test, TestingModule } from '@nestjs/testing';
import { ShiftController } from '../../src/infrastructure/web/controllers/shift.controller';
import { ShiftService } from '../../src/application/services/shift.service';
import { GetShiftStatusUseCase } from '../../src/application/use-cases/shift/get-shift-status.use-case';
import { OpenShiftUseCase } from '../../src/application/use-cases/shift/open-shift.use-case';
import { CloseShiftUseCase } from '../../src/application/use-cases/shift/close-shift.use-case';

describe('ShiftController', () => {
  let controller: ShiftController;
  let mockService: {
    closeFusionShift: jest.Mock;
    getShiftSalesReport: jest.Mock;
    getAvailableShifts: jest.Mock;
  };
  let mockGetStatus: { execute: jest.Mock };
  let mockOpen: { execute: jest.Mock };
  let mockClose: { execute: jest.Mock };

  beforeEach(async () => {
    mockService = {
      closeFusionShift: jest.fn(),
      getShiftSalesReport: jest.fn(),
      getAvailableShifts: jest.fn(),
    };
    mockGetStatus = { execute: jest.fn() };
    mockOpen = { execute: jest.fn() };
    mockClose = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftController],
      providers: [
        { provide: ShiftService, useValue: mockService },
        { provide: GetShiftStatusUseCase, useValue: mockGetStatus },
        { provide: OpenShiftUseCase, useValue: mockOpen },
        { provide: CloseShiftUseCase, useValue: mockClose },
      ],
    }).compile();

    controller = module.get<ShiftController>(ShiftController);
  });

  it('getOpenShift delega en el use-case', async () => {
    mockGetStatus.execute.mockResolvedValue({ Shift: null });

    await controller.getOpenShift('001', 'John', 'POS01');

    expect(mockGetStatus.execute).toHaveBeenCalledWith('001', 'POS01', 'John');
  });

  it('openShift delega en el use-case', async () => {
    mockOpen.execute.mockResolvedValue({ Shift: '1' });
    const dto = {
      storeId: '001',
      posNo: 'POS01',
      employeeName: 'John',
      initialAmount: 500,
      shiftNumber: 1,
    };

    await controller.openShift(dto);

    expect(mockOpen.execute).toHaveBeenCalledWith({
      storeId: '001',
      posNo: 'POS01',
      employeeName: 'John',
      initialAmount: 500,
      shiftNumber: 1,
    });
  });

  it('closeShift delega y devuelve éxito', async () => {
    mockClose.execute.mockResolvedValue({ success: true });
    const dto = {
      storeId: '001',
      posNo: 'POS01',
      employeeName: 'John',
      actualAmount: 0,
    };

    const result = await controller.closeShift(dto);

    expect(mockClose.execute).toHaveBeenCalledWith({
      storeId: '001',
      posNo: 'POS01',
      employeeName: 'John',
      actualAmount: 0,
    });
    expect(result).toEqual({ success: true });
  });

  it('closeFusionShift delega en el servicio', async () => {
    mockService.closeFusionShift.mockResolvedValue({ success: true });
    const dto = {
      storeId: '001',
      posNo: 'POS01',
      employeeName: 'John',
      actualAmount: 0,
    };

    await controller.closeFusionShift(dto);

    expect(mockService.closeFusionShift).toHaveBeenCalledWith(dto);
  });

  it('getShiftSalesReport delega en el servicio', async () => {
    mockService.getShiftSalesReport.mockResolvedValue([]);

    await controller.getShiftSalesReport(
      '001',
      'POS01',
      'John',
      '1',
      '2026-01-15',
    );

    expect(mockService.getShiftSalesReport).toHaveBeenCalledWith(
      '001',
      'POS01',
      'John',
      '1',
      '2026-01-15',
    );
  });

  it('getAvailableShifts delega en el servicio', async () => {
    mockService.getAvailableShifts.mockResolvedValue([]);

    await controller.getAvailableShifts('001', 'POS01', '2026-01-15');

    expect(mockService.getAvailableShifts).toHaveBeenCalledWith(
      '001',
      'POS01',
      '2026-01-15',
    );
  });
});

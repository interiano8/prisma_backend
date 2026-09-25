import { CloseShiftUseCase } from '../../../../src/application/use-cases/shift/close-shift.use-case';
import { ShiftRepository } from '../../../../src/domain/ports/out/shift-repository.interface';
import { DispenserRepository } from '../../../../src/domain/ports/out/dispenser-repository.interface';
import { StoreConfigRepository } from '../../../../src/domain/ports/out/store-config-repository.interface';
import { CloseShiftCommand } from '../../../../src/domain/entities/shift.entity';
import {
  NotFoundDomainError,
  BadRequestDomainError,
} from '../../../../src/domain/errors/domain-error';

describe('CloseShiftUseCase', () => {
  let useCase: CloseShiftUseCase;
  let mockRepository: jest.Mocked<ShiftRepository>;
  let mockDispenser: jest.Mocked<DispenserRepository>;
  let mockStoreConfig: jest.Mocked<StoreConfigRepository>;

  const command: CloseShiftCommand = {
    storeId: '001',
    posNo: 'POS01',
    employeeName: 'John Doe',
    actualAmount: 1500.5,
  };

  const openShift = {
    id: 1,
    isOpen: true,
    shiftNumber: '1',
    storeId: '001',
    posNo: 'POS01',
    employeeName: 'John Doe',
    initialAmount: 500,
    actualAmount: null,
    posTransactionId: 'TX1',
    shiftStarting: new Date('2026-01-15T08:00:00Z'),
    shiftEnding: null,
  };

  beforeEach(() => {
    mockRepository = {
      findOpenShift: jest.fn(),
      findOpenShiftFromDb: jest.fn(),
      getOpenShiftByEmployee: jest.fn(),
      createShift: jest.fn(),
      closeShift: jest.fn(),
      countTurnoControladorByPeriod: jest.fn(),
      createTurnoControlador: jest.fn(),
      getAvailableShifts: jest.fn(),
      getSalesReportData: jest.fn(),
      getOpenShiftSaleIds: jest.fn(),
    } as jest.Mocked<ShiftRepository>;
    mockDispenser = {
      getPendingSales: jest.fn(),
      getPendingSalesByUserShifts: jest.fn(),
      getPendingSalesForPos: jest.fn(),
      getSaleById: jest.fn(),
      getHoseFsMapping: jest.fn(),
      getItemMetadata: jest.fn(),
      getHoseConfigs: jest.fn(),
      getSimpleHoseConfigs: jest.fn(),
      getPumpTransactions: jest.fn(),
      updateSaleInvoiced: jest.fn(),
      reverseFusionSale: jest.fn(),
      renewTransactions: jest.fn(),
      getHoseFsForPos: jest.fn(),
      countPendingSalesForPos: jest.fn(),
      getExistingSaleIds: jest.fn(),
      createSales: jest.fn(),
      restartControlador: jest.fn(),
    } as jest.Mocked<DispenserRepository>;
    mockStoreConfig = {
      findByStoreId: jest.fn(),
      findBlockedForPendingTransactions: jest.fn(),
      findBlockedForPendingBomba: jest.fn(),
      findBlockedForPendingTurno: jest.fn(),
      findHideShiftInfo: jest.fn(),
      findExchangeRate: jest.fn(),
      findTasaByGrupo: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<StoreConfigRepository>;
    useCase = new CloseShiftUseCase(
      mockRepository,
      mockDispenser,
      mockStoreConfig,
    );
  });

  it('cierra el turno cuando existe un turno abierto y no hay pendientes', async () => {
    mockRepository.findOpenShift.mockResolvedValue(openShift as never);
    mockStoreConfig.findBlockedForPendingBomba.mockResolvedValue(false);
    mockStoreConfig.findBlockedForPendingTurno.mockResolvedValue(false);
    mockRepository.closeShift.mockResolvedValue({ success: true });

    const result = await useCase.execute(command);

    expect(mockRepository.findOpenShift).toHaveBeenCalledWith(
      '001',
      'POS01',
      'John Doe',
    );
    expect(mockRepository.closeShift).toHaveBeenCalledWith(command);
    expect(result).toEqual({ success: true });
  });

  it('lanza NotFoundDomainError cuando no hay turno abierto', async () => {
    mockRepository.findOpenShift.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toThrow(NotFoundDomainError);
    expect(mockRepository.closeShift).not.toHaveBeenCalled();
  });

  it('bloquea por ventas pendientes en las caras del POS (caso 1)', async () => {
    mockRepository.findOpenShift.mockResolvedValue(openShift as never);
    mockStoreConfig.findBlockedForPendingBomba.mockResolvedValue(true);
    mockStoreConfig.findBlockedForPendingTurno.mockResolvedValue(false);
    mockDispenser.getPendingSalesForPos.mockResolvedValue([
      { SaleID: 9001, PumpNumber: 1, HoseId: 2, amount: 100, ppu: 50, volume: 2, GradeNr: 3, IsInvoiced: false, ShiftId: 20260101 },
    ] as never);
    mockDispenser.getHoseConfigs.mockResolvedValue([
      { pumpId: 1, hosePhysicalId: 2, gradeName: 'REGULAR' },
    ] as never);

    const error = await useCase
      .execute(command)
      .catch((e: Error) => e as BadRequestDomainError);

    expect(error).toBeInstanceOf(BadRequestDomainError);
    expect((error as BadRequestDomainError).details).toEqual({ caras: ['Bomba 1 · REGULAR'], ventas: [] });
    expect(mockRepository.closeShift).not.toHaveBeenCalled();
  });

  it('bloquea por ventas pendientes del turno de Fusion del usuario (caso 2)', async () => {
    mockRepository.findOpenShift.mockResolvedValue(openShift as never);
    mockStoreConfig.findBlockedForPendingBomba.mockResolvedValue(false);
    mockStoreConfig.findBlockedForPendingTurno.mockResolvedValue(true);
    mockRepository.getOpenShiftSaleIds.mockResolvedValue([9001]);
    mockDispenser.getPendingSalesByUserShifts.mockResolvedValue({
      shifts: [20260101],
      pendientes: [
        { saleId: 9001, pumpId: 1, hoseId: 2, shiftId: 20260101, amount: 100, volume: 2 },
      ],
    });

    const error = await useCase
      .execute(command)
      .catch((e: Error) => e as BadRequestDomainError);

    expect(error).toBeInstanceOf(BadRequestDomainError);
    expect((error as BadRequestDomainError).details).toEqual({
      caras: [],
      ventas: ['Venta #9001 · turno 20260101'],
    });
    expect(mockRepository.closeShift).not.toHaveBeenCalled();
  });

  it('no bloquea el caso 2 si el turno no tiene ventas con sale_id', async () => {
    mockRepository.findOpenShift.mockResolvedValue(openShift as never);
    mockStoreConfig.findBlockedForPendingBomba.mockResolvedValue(false);
    mockStoreConfig.findBlockedForPendingTurno.mockResolvedValue(true);
    mockRepository.getOpenShiftSaleIds.mockResolvedValue([]);
    mockRepository.closeShift.mockResolvedValue({ success: true });

    const result = await useCase.execute(command);

    expect(result).toEqual({ success: true });
    expect(mockDispenser.getPendingSalesByUserShifts).not.toHaveBeenCalled();
  });
});
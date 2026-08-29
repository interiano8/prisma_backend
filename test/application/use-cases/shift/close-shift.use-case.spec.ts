import { CloseShiftUseCase } from '../../../../src/application/use-cases/shift/close-shift.use-case';
import { ShiftRepository } from '../../../../src/domain/ports/out/shift-repository.interface';
import { CloseShiftCommand } from '../../../../src/domain/entities/shift.entity';
import { NotFoundDomainError } from '../../../../src/domain/errors/domain-error';

describe('CloseShiftUseCase', () => {
  let useCase: CloseShiftUseCase;
  let mockRepository: jest.Mocked<ShiftRepository>;

  const command: CloseShiftCommand = {
    storeId: '001',
    posNo: 'POS01',
    employeeName: 'John Doe',
    actualAmount: 1500.5,
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
    };
    useCase = new CloseShiftUseCase(mockRepository);
  });

  it('cierra el turno cuando existe un turno abierto', async () => {
    mockRepository.findOpenShift.mockResolvedValue({
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
    });
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
});

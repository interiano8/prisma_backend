import { GetShiftStatusUseCase } from '../../../../src/application/use-cases/shift/get-shift-status.use-case';
import { ShiftRepository } from '../../../../src/domain/ports/out/shift-repository.interface';

describe('GetShiftStatusUseCase', () => {
  let useCase: GetShiftStatusUseCase;
  let mockRepository: jest.Mocked<ShiftRepository>;

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
    useCase = new GetShiftStatusUseCase(mockRepository);
  });

  it('devuelve el turno de la base de datos cuando existe', async () => {
    mockRepository.findOpenShiftFromDb.mockResolvedValue({
      Shift: '3',
      'POS Transaction ID': 'TX-DB',
      'Shift Starting': '2026-01-15T09:00:00Z',
    });

    const result = await useCase.execute('001', 'POS01', 'John');

    expect(mockRepository.findOpenShiftFromDb).toHaveBeenCalledWith(
      '001',
      'POS01',
      'John',
    );
    expect(result).toEqual({
      Shift: '3',
      'POS Transaction ID': 'TX-DB',
      'Shift Starting': '2026-01-15T09:00:00Z',
    });
    expect(mockRepository.findOpenShift).not.toHaveBeenCalled();
  });

  it('usa los campos en minúscula como respaldo', async () => {
    mockRepository.findOpenShiftFromDb.mockResolvedValue({
      Shift: null,
      shift: '5',
      posTransactionId: 'TX-LOW',
      shiftStarting: '2026-01-15T10:00:00Z',
    });

    const result = await useCase.execute('001', 'POS01', 'John');

    expect(result).toEqual({
      Shift: '5',
      'POS Transaction ID': 'TX-LOW',
      'Shift Starting': '2026-01-15T10:00:00Z',
    });
  });

  it('recurre al turno local cuando la base de datos no devuelve uno', async () => {
    mockRepository.findOpenShiftFromDb.mockResolvedValue({
      Message: 'No open shift found',
      Shift: null,
    });
    mockRepository.findOpenShift.mockResolvedValue({
      id: 9,
      isOpen: true,
      shiftNumber: '2',
      storeId: '001',
      posNo: 'POS01',
      employeeName: 'John',
      initialAmount: 100,
      actualAmount: null,
      posTransactionId: 'TX-LOCAL',
      shiftStarting: new Date('2026-01-15T08:30:00Z'),
      shiftEnding: null,
    });

    const result = await useCase.execute('001', 'POS01', 'John');

    expect(result.Shift).toBe('2');
    expect(result['POS Transaction ID']).toBe('TX-LOCAL');
    expect(result['Shift Starting']).toMatch(/2026-01-15/);
  });

  it('devuelve "No open shift found" cuando no hay ningún turno', async () => {
    mockRepository.findOpenShiftFromDb.mockResolvedValue({
      Message: 'No open shift found',
      Shift: null,
    });
    mockRepository.findOpenShift.mockResolvedValue(null);

    const result = await useCase.execute('001', 'POS01', 'John');

    expect(result.Message).toBe('No open shift found');
    expect(result.Shift).toBeNull();
  });

  it('aplica valores por defecto cuando faltan campos del turno de BD', async () => {
    mockRepository.findOpenShiftFromDb.mockResolvedValue({ Shift: null });

    const result = await useCase.execute('001', 'POS01', 'John');

    expect(result.Shift).toBe('1');
    expect(result['POS Transaction ID']).toBe('TX-DEFAULT');
    expect(result['Shift Starting']).not.toBe('');
  });
});

import { OpenShiftUseCase } from '../../../../src/application/use-cases/shift/open-shift.use-case';
import { ShiftRepository } from '../../../../src/domain/ports/out/shift-repository.interface';
import { OpenShiftCommand } from '../../../../src/domain/entities/shift.entity';
import { toServerIso } from '../../../../src/utils/datetime';
import { BadRequestDomainError } from '../../../../src/domain/errors/domain-error';

describe('OpenShiftUseCase', () => {
  let useCase: OpenShiftUseCase;
  let mockShiftRepository: jest.Mocked<ShiftRepository>;

  const validCommand: OpenShiftCommand = {
    storeId: '001',
    posNo: 'POS01',
    employeeName: 'John Doe',
    initialAmount: 500.0,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockShiftRepository = {
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

    useCase = new OpenShiftUseCase(mockShiftRepository);
  });

  describe('open shift with valid data', () => {
    it('should open a shift successfully when none is open', async () => {
      mockShiftRepository.findOpenShift.mockResolvedValue(null);

      const mockShift = {
        id: 1,
        isOpen: true,
        shiftNumber: '1',
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John Doe',
        initialAmount: 500.0,
        actualAmount: null,
        posTransactionId: 'TX12345',
        shiftStarting: new Date('2026-01-15T08:00:00Z'),
        shiftEnding: null,
      };

      mockShiftRepository.createShift.mockResolvedValue(mockShift);

      const result = await useCase.execute(validCommand);

      expect(result.Shift).toBe('1');
      expect(result['POS Transaction ID']).toBe('TX12345');
      expect(result['Shift Starting']).toBe(
        toServerIso(mockShift.shiftStarting),
      );
      expect(mockShiftRepository.createShift).toHaveBeenCalledWith(
        validCommand,
      );
    });

    it('should pass correct data to repository', async () => {
      mockShiftRepository.findOpenShift.mockResolvedValue(null);

      const mockShift = {
        id: 2,
        isOpen: true,
        shiftNumber: '2',
        storeId: '002',
        posNo: 'POS02',
        employeeName: 'Maria Lopez',
        initialAmount: 1000.0,
        actualAmount: null,
        posTransactionId: 'TX67890',
        shiftStarting: new Date('2026-06-15T14:00:00Z'),
        shiftEnding: null,
      };

      mockShiftRepository.createShift.mockResolvedValue(mockShift);

      const command: OpenShiftCommand = {
        storeId: '002',
        posNo: 'POS02',
        employeeName: 'Maria Lopez',
        initialAmount: 1000.0,
      };

      const result = await useCase.execute(command);

      expect(mockShiftRepository.findOpenShift).toHaveBeenCalledWith(
        '002',
        'POS02',
        'Maria Lopez',
      );
      expect(mockShiftRepository.createShift).toHaveBeenCalledWith(command);
      expect(result['POS Transaction ID']).toBe('TX67890');
    });
  });

  describe('open shift when already open', () => {
    it('should throw BadRequestDomainError when a shift is already open', async () => {
      const existingShift = {
        id: 1,
        isOpen: true,
        shiftNumber: '1',
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John Doe',
        initialAmount: 500.0,
        actualAmount: null,
        posTransactionId: 'TX00001',
        shiftStarting: new Date('2026-01-15T08:00:00Z'),
        shiftEnding: null,
      };

      mockShiftRepository.findOpenShift.mockResolvedValue(existingShift);

      await expect(useCase.execute(validCommand)).rejects.toThrow(
        BadRequestDomainError,
      );
      await expect(useCase.execute(validCommand)).rejects.toThrow(
        'Ya existe un turno abierto para este empleado en la estación',
      );

      expect(mockShiftRepository.createShift).not.toHaveBeenCalled();
    });
  });

  describe('errores de apertura', () => {
    it('propaga BadRequestDomainError de createShift sin envolverlo', async () => {
      mockShiftRepository.findOpenShift.mockResolvedValue(null);
      mockShiftRepository.createShift.mockRejectedValue(
        new BadRequestDomainError('monto inválido'),
      );

      await expect(useCase.execute(validCommand)).rejects.toThrow(
        BadRequestDomainError,
      );
      await expect(useCase.execute(validCommand)).rejects.toThrow(
        'monto inválido',
      );
    });

    it('envuelve errores genéricos en InternalDomainError', async () => {
      mockShiftRepository.findOpenShift.mockResolvedValue(null);
      mockShiftRepository.createShift.mockRejectedValue(new Error('db down'));

      await expect(useCase.execute(validCommand)).rejects.toThrow(
        'Error al abrir turno: db down',
      );
    });

    it('serializa errores no-Error en el mensaje interno', async () => {
      mockShiftRepository.findOpenShift.mockResolvedValue(null);
      mockShiftRepository.createShift.mockRejectedValue('boom');

      await expect(useCase.execute(validCommand)).rejects.toThrow(
        'Error al abrir turno: "boom"',
      );

      mockShiftRepository.createShift.mockRejectedValue({ code: 1 });
      await expect(useCase.execute(validCommand)).rejects.toThrow(
        'Error al abrir turno: {"code":1}',
      );
    });

    it('usa mensaje genérico si el valor no es serializable', async () => {
      mockShiftRepository.findOpenShift.mockResolvedValue(null);
      mockShiftRepository.createShift.mockRejectedValue(undefined);

      await expect(useCase.execute(validCommand)).rejects.toThrow(
        'Error al abrir turno: error desconocido',
      );
    });
  });
});

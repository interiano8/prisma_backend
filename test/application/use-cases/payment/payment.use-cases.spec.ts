import { GetPaymentMethodsUseCase } from '../../../../src/application/use-cases/payment/get-payment-methods.use-case';
import { ProcessPaymentUseCase } from '../../../../src/application/use-cases/payment/process-payment.use-case';
import type { PaymentRepository } from '../../../../src/domain/ports/out/payment-repository.interface';

function mockPaymentRepository(): jest.Mocked<PaymentRepository> {
  return {
    getPaymentMethods: jest.fn(),
    processPayment: jest.fn(),
  };
}

describe('GetPaymentMethodsUseCase', () => {
  let useCase: GetPaymentMethodsUseCase;
  let mockRepository: jest.Mocked<PaymentRepository>;

  beforeEach(() => {
    mockRepository = mockPaymentRepository();
    useCase = new GetPaymentMethodsUseCase(mockRepository);
  });

  it('devuelve los medios de pago del repositorio', async () => {
    const methods = [
      {
        code: '01',
        description: 'EFECTIVO',
        categoria: 'Efectivo',
        facturaContado: true,
        facturaCredito: false,
        salidaCombustible: false,
        fidelizacion: false,
        requiereReferencia: false,
        imagen: null,
        activo: true,
      },
    ];
    mockRepository.getPaymentMethods.mockResolvedValue(methods);

    const result = await useCase.execute();

    expect(mockRepository.getPaymentMethods).toHaveBeenCalled();
    expect(result).toEqual(methods);
  });
});

describe('ProcessPaymentUseCase', () => {
  let useCase: ProcessPaymentUseCase;
  let mockRepository: jest.Mocked<PaymentRepository>;

  beforeEach(() => {
    mockRepository = mockPaymentRepository();
    useCase = new ProcessPaymentUseCase(mockRepository);
  });

  it('procesa el pago delegando en el repositorio', async () => {
    const dto = {
      storeId: '001',
      posNo: 'POS01',
      shiftNumber: '1',
      customerNo: 'CF',
      customerName: 'CONSUMIDOR FINAL',
      items: [],
      payments: [],
      total: 100,
      tax: 15,
      discount: 0,
    };
    mockRepository.processPayment.mockResolvedValue({
      success: true,
      invoiceNo: 'F001',
    });

    const result = await useCase.execute(dto);

    expect(mockRepository.processPayment).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ success: true, invoiceNo: 'F001' });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from '../../../../src/infrastructure/web/controllers/payment.controller';
import { GetPaymentMethodsUseCase } from '../../../../src/application/use-cases/payment/get-payment-methods.use-case';
import { ProcessPaymentUseCase } from '../../../../src/application/use-cases/payment/process-payment.use-case';

describe('PaymentController', () => {
  let controller: PaymentController;
  let mockUseCases: {
    getPaymentMethods: { execute: jest.Mock };
    processPayment: { execute: jest.Mock };
  };

  beforeEach(async () => {
    mockUseCases = {
      getPaymentMethods: { execute: jest.fn() },
      processPayment: { execute: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: GetPaymentMethodsUseCase,
          useValue: mockUseCases.getPaymentMethods,
        },
        {
          provide: ProcessPaymentUseCase,
          useValue: mockUseCases.processPayment,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('getMethods devuelve los medios de pago', async () => {
    mockUseCases.getPaymentMethods.execute.mockResolvedValue([
      { code: '01', description: 'EFECTIVO' },
    ]);

    const result = await controller.getMethods();

    expect(mockUseCases.getPaymentMethods.execute).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('process delega el pago al use-case', async () => {
    mockUseCases.processPayment.execute.mockResolvedValue({
      success: true,
      invoiceNo: 'F001',
    });
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

    const result = await controller.process(dto);

    expect(mockUseCases.processPayment.execute).toHaveBeenCalledWith(dto);
    expect(result.invoiceNo).toBe('F001');
  });
});

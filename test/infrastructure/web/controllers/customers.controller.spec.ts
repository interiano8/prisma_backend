import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from '../../../../src/infrastructure/web/controllers/customers.controller';
import { SearchCustomersUseCase } from '../../../../src/application/use-cases/customer/search-customers.use-case';
import { GetConsumidorFinalUseCase } from '../../../../src/application/use-cases/customer/get-consumidor-final.use-case';
import { CreateCustomerUseCase } from '../../../../src/application/use-cases/customer/create-customer.use-case';
import { GetCustomerByCodeUseCase } from '../../../../src/application/use-cases/customer/get-customer-by-code.use-case';

describe('CustomersController', () => {
  let controller: CustomersController;
  let mockCreate: { execute: jest.Mock };
  let mockSearch: { execute: jest.Mock };
  let mockCf: { execute: jest.Mock };
  let mockByCode: { execute: jest.Mock };

  beforeEach(async () => {
    mockCreate = { execute: jest.fn() };
    mockSearch = { execute: jest.fn() };
    mockCf = { execute: jest.fn() };
    mockByCode = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CreateCustomerUseCase, useValue: mockCreate },
        { provide: SearchCustomersUseCase, useValue: mockSearch },
        { provide: GetConsumidorFinalUseCase, useValue: mockCf },
        { provide: GetCustomerByCodeUseCase, useValue: mockByCode },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  it('create delega en el use-case', async () => {
    mockCreate.execute.mockResolvedValue({ success: true });
    const dto = { name: 'ana', rtn: '0801' };

    expect(await controller.create(dto)).toEqual({ success: true });
    expect(mockCreate.execute).toHaveBeenCalledWith(dto);
  });

  it('search traduce creditOnly a booleano', async () => {
    mockSearch.execute.mockResolvedValue([]);

    await controller.search('ana', 'true');

    expect(mockSearch.execute).toHaveBeenCalledWith('ana', true, undefined, undefined);
  });

  it('getConsumidorFinal delega en el use-case', async () => {
    mockCf.execute.mockResolvedValue(null);

    expect(await controller.getConsumidorFinal()).toBeNull();
  });

  it('getByCode delega en el use-case', async () => {
    mockByCode.execute.mockResolvedValue(null);

    expect(await controller.getByCode('C001')).toBeNull();
    expect(mockByCode.execute).toHaveBeenCalledWith('C001');
  });
});

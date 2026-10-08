import { CheckCustomerCreditUseCase } from '../../../../src/application/use-cases/customer/check-customer-credit.use-case';
import { NotFoundException } from '@nestjs/common';

describe('CheckCustomerCreditUseCase', () => {
  let useCase: CheckCustomerCreditUseCase;
  let customerRepoMock: any;
  let storeConfigRepoMock: any;

  beforeEach(() => {
    customerRepoMock = {
      findByCode: jest.fn(),
      refreshCustomerData: jest.fn().mockResolvedValue(undefined),
    };
    storeConfigRepoMock = {
      findCreditCheckTimeoutMs: jest.fn().mockResolvedValue(100),
    };

    useCase = new CheckCustomerCreditUseCase(customerRepoMock, storeConfigRepoMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retorna ONLINE cuando la llamada central responde exitosamente', async () => {
    const centralResponse = {
      customerNo: 'CLI-01',
      customerName: 'Cliente Central',
      balance: 1000,
      creditLimit: 5000,
      blocked: false,
      blockOnOverdue: true,
      hasOverdueInvoices: false,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(centralResponse),
    } as any);

    const result = await useCase.execute('CLI-01', 2000);

    expect(result.source).toBe('ONLINE');
    expect(result.creditLimit).toBe(5000);
    expect(result.balance).toBe(1000);
    expect(result.disponible).toBe(4000);
    expect(result.isAllowed).toBe(true);
    expect(customerRepoMock.refreshCustomerData).toHaveBeenCalledWith('CLI-01', {
      balance: 1000,
      creditLimit: 5000,
      blocked: false,
    });
  });

  it('conmuta a OFFLINE_FALLBACK si fetch falla o timeout', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

    customerRepoMock.findByCode.mockResolvedValue({
      code: 'CLI-01',
      name: 'Cliente Local',
      balance: 1500,
      creditLimit: 5000,
      blocked: false,
      blockOnOverdue: true,
      hasOverdueInvoices: false,
    });

    const result = await useCase.execute('CLI-01', 2000);

    expect(result.source).toBe('OFFLINE_FALLBACK');
    expect(result.balance).toBe(1500);
    expect(result.disponible).toBe(3500);
    expect(result.isAllowed).toBe(true);
    expect(customerRepoMock.findByCode).toHaveBeenCalledWith('CLI-01');
  });

  it('rechaza si el monto solicitado excede el crédito disponible', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    customerRepoMock.findByCode.mockResolvedValue({
      code: 'CLI-01',
      name: 'Cliente Local',
      balance: 4500,
      creditLimit: 5000,
      blocked: false,
      blockOnOverdue: true,
      hasOverdueInvoices: false,
    });

    const result = await useCase.execute('CLI-01', 1000);

    expect(result.source).toBe('OFFLINE_FALLBACK');
    expect(result.disponible).toBe(500);
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain('excede el saldo disponible');
  });

  it('lanza NotFoundException si no existe ni en matriz ni local', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false } as any);
    customerRepoMock.findByCode.mockResolvedValue(null);

    await expect(useCase.execute('NO-EXISTE')).rejects.toThrow(NotFoundException);
  });
});

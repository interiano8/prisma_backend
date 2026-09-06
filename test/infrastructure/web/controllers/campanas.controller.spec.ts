import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CampanasController } from '../../../../src/infrastructure/web/controllers/campanas.controller';
import type { CampanasRepository } from '../../../../src/domain/ports/out/campanas-repository.interface';

describe('CampanasController', () => {
  let controller: CampanasController;
  let repo: jest.Mocked<CampanasRepository>;

  beforeEach(async () => {
    repo = {
      getActiveCampanas: jest.fn(),
      getCampanaConditions: jest.fn(),
      getItemCategories: jest.fn(),
      countParticipaciones: jest.fn(),
      saveParticipacion: jest.fn(),
      getTicketByCorrelativo: jest.fn(),
      listCampanas: jest.fn(),
      createCampana: jest.fn(),
      updateCampana: jest.fn(),
      deleteCampana: jest.fn(),
      createCondicion: jest.fn(),
      updateCondicion: jest.fn(),
      deleteCondicion: jest.fn(),
    } as any;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampanasController],
      providers: [{ provide: 'CampanasRepository', useValue: repo }],
    }).compile();
    controller = module.get(CampanasController);
  });

  it('crea campaña y normaliza modoEvaluacion', async () => {
    repo.createCampana.mockResolvedValue({ id: 1 });
    await controller.createCampana({
      nombre: 'Navidad',
      modoEvaluacion: 'all',
      limitePorCliente: 3,
    });
    expect(repo.createCampana).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Navidad',
        modoEvaluacion: 'ALL',
        limitePorCliente: 3,
        activo: true,
      }),
    );
  });

  it('rechaza modoEvaluacion inválido', async () => {
    await expect(
      controller.createCampana({ modoEvaluacion: 'RARO' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('crea condición válida', async () => {
    repo.createCondicion.mockResolvedValue({ id: 9 });
    await controller.createCondicion('1', {
      tipoEvaluacion: 'total_factura',
      operador: 'gte',
      valorMonto: 500,
    });
    expect(repo.createCondicion).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tipoEvaluacion: 'TOTAL_FACTURA',
        operador: 'GTE',
        valorMonto: 500,
      }),
    );
  });

  it('rechaza condición con tipo fuera del enum', async () => {
    await expect(
      controller.createCondicion('1', {
        tipoEvaluacion: 'NO_EXISTE',
        operador: 'EQ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifica ticket existente', async () => {
    repo.getTicketByCorrelativo.mockResolvedValue({
      correlativo: 'CORR1',
      campanaId: 1,
      nombreCampana: 'C1',
      idTransaccionPos: 'TX1',
      codigoCliente: 'CLI',
    });
    const res = await controller.verificarTicket('CORR1');
    expect(res.valido).toBe(true);
    expect(res.ticket!.nombreCampana).toBe('C1');
  });

  it('verifica ticket inexistente', async () => {
    repo.getTicketByCorrelativo.mockResolvedValue(null);
    const res = await controller.verificarTicket('NOPE');
    expect(res.valido).toBe(false);
    expect(res.ticket).toBeNull();
  });

  it('listCampanas y deleteCampana delegan', async () => {
    repo.listCampanas.mockResolvedValue([]);
    repo.deleteCampana.mockResolvedValue(undefined);

    expect(await controller.listCampanas()).toEqual([]);
    await controller.deleteCampana('1');
    expect(repo.deleteCampana).toHaveBeenCalledWith(1);
  });

  it('updateCampana valida, parsea id y delega', async () => {
    repo.updateCampana.mockResolvedValue({ id: 1 });
    await controller.updateCampana('2', { nombre: 'N', modoEvaluacion: 'any' });
    expect(repo.updateCampana).toHaveBeenCalledWith(2, expect.objectContaining({ nombre: 'N' }));

    await expect(controller.updateCampana('abc', {})).rejects.toThrow(BadRequestException);
  });

  it('updateCondicion y deleteCondicion delegan', async () => {
    repo.updateCondicion.mockResolvedValue({ id: 9 });
    repo.deleteCondicion.mockResolvedValue(undefined);

    await controller.updateCondicion('3', {
      tipoEvaluacion: 'total_factura',
      operador: 'lte',
      valorMonto: 100,
    });
    expect(repo.updateCondicion).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ tipoEvaluacion: 'TOTAL_FACTURA', operador: 'LTE' }),
    );

    await controller.deleteCondicion('3');
    expect(repo.deleteCondicion).toHaveBeenCalledWith(3);
  });

  it('rechaza operador inválido', async () => {
    await expect(
      controller.createCondicion('1', { tipoEvaluacion: 'total_factura', operador: 'OOPS' }),
    ).rejects.toThrow(BadRequestException);
  });
});
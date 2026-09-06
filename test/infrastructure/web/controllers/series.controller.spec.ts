import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SeriesController } from '../../../../src/infrastructure/web/controllers/series.controller';
import type { SeriesRepository } from '../../../../src/domain/ports/out/series-repository.interface';
import { TOKEN_PORT } from '../../../../src/domain/ports/out/token.interface';
import { JwtAuthGuard } from '../../../../src/infrastructure/web/guards/jwt-auth.guard';
import { AdminGuard } from '../../../../src/infrastructure/web/guards/admin.guard';

describe('SeriesController', () => {
  let controller: SeriesController;
  let repo: jest.Mocked<SeriesRepository>;

  beforeEach(async () => {
    repo = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      close: jest.fn(),
      setEditing: jest.fn(),
    } as any;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeriesController],
      providers: [
        { provide: 'SeriesRepository', useValue: repo },
        { provide: TOKEN_PORT, useValue: { sign: jest.fn(), verify: jest.fn() } },
        JwtAuthGuard,
        AdminGuard,
      ],
    }).compile();
    controller = module.get(SeriesController);
  });

  it('crea un rango FV-HN con CAI válido', async () => {
    repo.create.mockResolvedValue({ numeroLinea: 11001 });
    await controller.create({
      codigoSerie: 'FV-HN',
      idTienda: '001',
      codigoPos: '01',
      numeroInicio: '000-040-01-00000001',
      numeroFin: '000-040-01-00025000',
      cai: '000-040-01-00025000',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ codigoSerie: 'FV-HN' }),
    );
  });

  it('rechaza un rango FV-HN con formato interno', async () => {
    await expect(
      controller.create({
        codigoSerie: 'FV-HN',
        idTienda: '001',
        codigoPos: '01',
        numeroInicio: '00101T00000000000',
        numeroFin: '00101T99999999999',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('acepta un rango TR-ID interno', async () => {
    repo.create.mockResolvedValue({ numeroLinea: 22001 });
    await controller.create({
      codigoSerie: 'TR-ID',
      idTienda: '001',
      codigoPos: '06',
      numeroInicio: '00106T00000000000',
      numeroFin: '00106T99999999999',
    });
    expect(repo.create).toHaveBeenCalled();
  });

  it('setEditing marca el bloqueo de edición', async () => {
    repo.setEditing.mockResolvedValue(undefined);
    await controller.setEditing('10001', 'FV-HN', { editing: true });
    expect(repo.setEditing).toHaveBeenCalledWith(10001, 'FV-HN', true);
  });

  it('list delega sin argumentos', async () => {
    repo.list.mockResolvedValue([]);
    await controller.list();
    expect(repo.list).toHaveBeenCalledWith(undefined, undefined);
  });

  it('update valida el formato cuando vienen inicio/fin', async () => {
    repo.update.mockResolvedValue(undefined);
    await controller.update('10001', 'FV-HN', {
      numeroInicio: '000-040-01-00000001',
    });
    expect(repo.update).toHaveBeenCalledWith(
      10001,
      'FV-HN',
      expect.objectContaining({ numeroInicio: '000-040-01-00000001' }),
    );
  });

  it('update rechaza un formato CAI inválido', async () => {
    await expect(
      controller.update('10001', 'FV-HN', { numeroFin: '00101T99999999999' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('close delega el cierre', async () => {
    repo.close.mockResolvedValue(undefined);
    await controller.close('10001', 'FV-HN');
    expect(repo.close).toHaveBeenCalledWith(10001, 'FV-HN');
  });

  it('parseId rechaza números inválidos', async () => {
    await expect(controller.setEditing('abc', 'FV-HN', { editing: true })).rejects.toThrow(
      BadRequestException,
    );
  });
});
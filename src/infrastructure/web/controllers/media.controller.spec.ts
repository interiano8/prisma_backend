import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MediaController } from './media.controller';

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  statSync: jest.fn(() => ({ isFile: () => true })),
}));
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    ...actual,
    resolve: (...a: string[]) => actual.join(...a),
    basename: (p: string) => p.split('/').pop(),
    extname: (p: string) => (p.includes('.') ? '.' + p.split('.').pop() : ''),
  };
});

describe('MediaController', () => {
  const mediaUseCase = {
    list: jest.fn(),
    listProgramacion: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getMediaDir: jest.fn(),
  };
  let controller: MediaController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MediaController(mediaUseCase as any);
  });

  it('list y listProgramacion delegan', async () => {
    mediaUseCase.list.mockResolvedValue([]);
    mediaUseCase.listProgramacion.mockResolvedValue([]);

    await controller.list();
    controller.listProgramacion();

    expect(mediaUseCase.list).toHaveBeenCalled();
    expect(mediaUseCase.listProgramacion).toHaveBeenCalled();
  });

  it('create valida el archivo y delega', async () => {
    mediaUseCase.create.mockResolvedValue({ id: 1 });

    await controller.create({ archivo: 'x.jpg' });

    expect(mediaUseCase.create).toHaveBeenCalledWith({ archivo: 'x.jpg' });
    await expect(controller.create({ archivo: '  ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('update y remove delegan', async () => {
    mediaUseCase.update.mockResolvedValue({});
    mediaUseCase.delete.mockResolvedValue(undefined);

    await controller.update('2', {});
    expect(mediaUseCase.update).toHaveBeenCalledWith('2', {});

    expect(await controller.remove('2')).toEqual({ success: true });
    expect(mediaUseCase.delete).toHaveBeenCalledWith('2');
  });

  it('file valida nombres inseguros', async () => {
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };

    await expect(controller.file('../etc/passwd', res as any)).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.file('a/b.jpg', res as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('file sirve con cache de video para extensiones de video', async () => {
    mediaUseCase.getMediaDir.mockResolvedValue('/media');
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };

    await controller.file('clip.mp4', res as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=2592000, immutable',
    );
    expect(res.sendFile).toHaveBeenCalled();
  });

  it('file sirve con cache de imagen para otras extensiones', async () => {
    mediaUseCase.getMediaDir.mockResolvedValue('/media');
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };

    await controller.file('img.jpg', res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
  });

  it('file lanza NotFound si el archivo no existe', async () => {
    mediaUseCase.getMediaDir.mockResolvedValue('/media');
    const res = { setHeader: jest.fn(), sendFile: jest.fn() };
    require('fs').existsSync.mockReturnValue(false);

    await expect(controller.file('x.jpg', res as any)).rejects.toThrow(
      NotFoundException,
    );
  });
});
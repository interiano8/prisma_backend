import { ProgramacionMediaUseCase } from './programacion-media.use-case';

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}));
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    ...actual,
    resolve: (...args: string[]) => actual.join(...args),
    basename: (p: string) => p.split('/').pop(),
    extname: (p: string) => (p.includes('.') ? '.' + p.split('.').pop() : ''),
  };
});

import { existsSync } from 'fs';

describe('ProgramacionMediaUseCase', () => {
  const repo = {
    getMediaDir: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  let useCase: ProgramacionMediaUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(true);
    useCase = new ProgramacionMediaUseCase(repo as any);
  });

  it('list filtra archivos existentes y clasifica por extensión', async () => {
    repo.getMediaDir.mockResolvedValue('/media');
    repo.list.mockResolvedValue([
      { id: 1, archivo: 'a.jpg', tipo: null },
      { id: 2, archivo: 'b.mp4', tipo: null },
    ]);

    const result = await useCase.list();

    expect(result).toEqual([
      { name: 'a.jpg', type: 'image', url: '/api/media/file/a.jpg' },
      { name: 'b.mp4', type: 'video', url: '/api/media/file/b.mp4' },
    ]);
  });

  it('list lanza si la carpeta no existe', async () => {
    repo.getMediaDir.mockResolvedValue('/media');
    (existsSync as jest.Mock).mockReturnValue(false);

    await expect(useCase.list()).rejects.toThrow('La carpeta multimedia no existe');
  });

  it('list filtra archivos que no existen en disco', async () => {
    repo.getMediaDir.mockResolvedValue('/media');
    repo.list.mockResolvedValue([{ id: 1, archivo: 'a.jpg', tipo: null }]);
    (existsSync as jest.Mock)
      .mockReturnValueOnce(true) // dir
      .mockReturnValueOnce(false); // archivo

    const result = await useCase.list();
    expect(result).toEqual([]);
  });

  it('create y update delegan mapeando el body', async () => {
    repo.create.mockResolvedValue({ id: 1 });
    repo.update.mockResolvedValue({ id: 1 });

    await useCase.create({
      archivo: 'x.png',
      tipo: 'image',
      fechaInicio: '2026-01-01',
      habilitado: false,
    });
    await useCase.update('5', { archivo: 'y.png' });

    expect(repo.create).toHaveBeenCalledWith({
      archivo: 'x.png',
      tipo: 'image',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: null,
      habilitado: false,
    });
    expect(repo.update).toHaveBeenCalledWith(5, expect.objectContaining({ archivo: 'y.png' }));
  });

  it('delete delega el id numérico', async () => {
    await useCase.delete('3');
    expect(repo.delete).toHaveBeenCalledWith(3);
  });
});
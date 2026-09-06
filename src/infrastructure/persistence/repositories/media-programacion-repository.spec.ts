import { MediaProgramacionRepositoryImpl } from './media-programacion-repository';

describe('MediaProgramacionRepositoryImpl', () => {
  const mediaProgramacion = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const tienda = { findFirst: jest.fn() };
  let repo: MediaProgramacionRepositoryImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MediaProgramacionRepositoryImpl({
      tienda,
      mediaProgramacion,
    } as any);
  });

  it('getMediaDir devuelve la carpeta configurada', async () => {
    tienda.findFirst.mockResolvedValue({ carpetaMultimedia: ' /media ' });
    expect(await repo.getMediaDir()).toBe('/media');
  });

  it('getMediaDir lanza si no está configurada', async () => {
    tienda.findFirst.mockResolvedValue({ carpetaMultimedia: '' });
    await expect(repo.getMediaDir()).rejects.toThrow(
      'Carpeta multimedia no configurada',
    );
  });

  it('list ordena por id', async () => {
    mediaProgramacion.findMany.mockResolvedValue([{ id: 1 }]);
    await repo.list();
    expect(mediaProgramacion.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
  });

  it('create mapea con defaults', async () => {
    mediaProgramacion.create.mockResolvedValue({ id: 1 });
    await repo.create({ archivo: 'a.jpg', habilitado: false });
    expect(mediaProgramacion.create).toHaveBeenCalledWith({
      data: {
        archivo: 'a.jpg',
        tipo: null,
        fechaInicio: null,
        fechaFin: null,
        habilitado: false,
      },
    });
  });

  it('update incluye solo campos definidos', async () => {
    mediaProgramacion.update.mockResolvedValue({ id: 1 });
    await repo.update(2, { archivo: 'b.jpg' });
    expect(mediaProgramacion.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { archivo: 'b.jpg' },
    });
  });

  it('delete borra por id', async () => {
    mediaProgramacion.delete.mockResolvedValue({});
    await repo.delete(3);
    expect(mediaProgramacion.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
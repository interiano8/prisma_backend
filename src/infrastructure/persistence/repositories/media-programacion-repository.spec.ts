import { MediaProgramacionRepositoryImpl } from './media-programacion-repository';

describe('MediaProgramacionRepositoryImpl', () => {
  const tienda = { findFirst: jest.fn() };
  let repo: MediaProgramacionRepositoryImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MediaProgramacionRepositoryImpl({ tienda } as any);
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

  it('create y list manejan elementos de programacion', async () => {
    const created = await repo.create({ archivo: 'a.jpg', habilitado: false });
    expect(created.archivo).toBe('a.jpg');
    expect(created.habilitado).toBe(false);

    const items = await repo.list();
    expect(items).toHaveLength(1);
    expect(items[0].archivo).toBe('a.jpg');
  });

  it('update incluye solo campos definidos', async () => {
    const created = await repo.create({ archivo: 'a.jpg' });
    const updated = await repo.update(created.id, { archivo: 'b.jpg' });
    expect(updated.archivo).toBe('b.jpg');
  });

  it('delete borra por id', async () => {
    const created = await repo.create({ archivo: 'c.jpg' });
    await repo.delete(created.id);
    const items = await repo.list();
    expect(items.find((x) => x.id === created.id)).toBeUndefined();
  });
});
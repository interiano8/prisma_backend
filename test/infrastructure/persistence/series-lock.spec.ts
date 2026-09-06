import { lockSeriesForUpdate } from '../../../src/infrastructure/persistence/series-lock';

describe('lockSeriesForUpdate', () => {
  const now = new Date('2026-08-15T12:00:00Z');

  const baseRow = (over: any = {}) => ({
    numeroLinea: 1,
    ultimoNumeroUsado: 'FV0000000000000001',
    numeroInicio: '0001',
    numeroFin: '9999',
    cai: 'CAI',
    fechaVenceRango: new Date('2027-01-01'),
    enEdicion: false,
    ...over,
  });

  it('bloquea la serie con FOR UPDATE y devuelve la fila con remaining', async () => {
    const row = baseRow();
    const tx = { $queryRaw: jest.fn().mockResolvedValue([row]) };

    const result = await lockSeriesForUpdate(
      tx as never,
      'FV-HN',
      '001',
      'POS01',
      now,
      true,
    );

    expect(result).toEqual(
      expect.objectContaining({
        numeroLinea: 1,
        ultimoNumeroUsado: 'FV0000000000000001',
        numeroInicio: '0001',
        numeroFin: '9999',
        cai: 'CAI',
        remaining: 9998,
        remainingDays: expect.any(Number),
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('devuelve null si no hay serie', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };

    const result = await lockSeriesForUpdate(
      tx as never,
      'TR-ID',
      '001',
      'POS01',
      now,
      false,
    );

    expect(result).toBeNull();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('auto-cierra el rango agotado por cantidad y salta al siguiente válido', async () => {
    const exhausted = baseRow({
      numeroLinea: 1,
      ultimoNumeroUsado: 'FV0000000000009999',
      numeroFin: '9999',
    });
    const valid = baseRow({
      numeroLinea: 2,
      ultimoNumeroUsado: 'FV0000000000000001',
      numeroFin: '8888',
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([exhausted, valid]),
      serieDocumento: { updateMany },
    };

    const result = await lockSeriesForUpdate(
      tx as never,
      'FV-HN',
      '001',
      'POS01',
      now,
      true,
    );

    expect(result?.numeroLinea).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ numeroLinea: 1 }),
        data: { abierta: false },
      }),
    );
  });

  it('rechaza si la serie del POS está en edición', async () => {
    const row = baseRow({ enEdicion: true });
    const tx = { $queryRaw: jest.fn().mockResolvedValue([row]) };

    await expect(
      lockSeriesForUpdate(tx as never, 'FV-HN', '001', 'POS01', now, true),
    ).rejects.toThrow('en edición');
  });
});
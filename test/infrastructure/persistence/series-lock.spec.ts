import { lockSeriesForUpdate } from '../../../src/infrastructure/persistence/series-lock';

describe('lockSeriesForUpdate', () => {
  const now = new Date('2026-08-15T12:00:00Z');

  it('bloquea la serie con FOR UPDATE y devuelve la fila', async () => {
    const row = {
      numeroLinea: 1,
      ultimoNumeroUsado: 'FV0000000000000001',
      numeroInicio: '0001',
      numeroFin: '9999',
      cai: 'CAI',
      fechaVenceRango: new Date('2027-01-01'),
    };
    const tx = { $queryRaw: jest.fn().mockResolvedValue([row]) };

    const result = await lockSeriesForUpdate(
      tx as never,
      'FV-HN',
      '001',
      'POS01',
      now,
      true,
    );

    expect(result).toEqual(row);
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
});

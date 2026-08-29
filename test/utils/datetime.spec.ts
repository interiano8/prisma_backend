import { serverNow, toServerIso } from '../../src/utils/datetime';

describe('datetime utils', () => {
  describe('toServerIso', () => {
    it('formatea con la hora local del servidor y el offset UTC', () => {
      const d = new Date(2026, 0, 15, 8, 0, 0, 123);
      const result = toServerIso(d);
      // Formato: YYYY-MM-DDTHH:MM:SS.mmm±HH:MM
      expect(result).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
      );

      const pad = (n: number) => String(n).padStart(2, '0');
      const localPrefix =
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.123`;
      expect(result.startsWith(localPrefix)).toBe(true);
    });

    it('devuelve cadena vacía para una fecha inválida', () => {
      expect(toServerIso(new Date('invalid'))).toBe('');
    });

    it('acepta strings parseables como fecha', () => {
      const result = toServerIso('2026-01-15T08:00:00.000Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('usa signo negativo y valor absoluto para offsets hacia el oeste', () => {
      const d = new Date(2026, 0, 15, 8, 0, 0, 0);
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(360);

      const result = toServerIso(d);

      expect(result).toContain('-06:00');
    });

    it('usa signo positivo para offsets hacia el este', () => {
      const d = new Date(2026, 0, 15, 8, 0, 0, 0);
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-240);

      const result = toServerIso(d);

      expect(result).toContain('+04:00');
    });

    it('acepta un Date ya parseado y devuelve el mismo formato', () => {
      const d = new Date('2026-08-15T14:30:00.000Z');
      const result = toServerIso(d);
      expect(result).toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}/,
      );
    });
  });

  describe('serverNow', () => {
    it('devuelve un Date cercano al momento actual', () => {
      const before = Date.now();
      const now = serverNow();
      const after = Date.now();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeGreaterThanOrEqual(before);
      expect(now.getTime()).toBeLessThanOrEqual(after);
    });
  });
});

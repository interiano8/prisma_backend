import {
  normalizeVolumeUnit,
  galonesALitros,
  litrosAGalones,
  GALON_TO_LITROS,
} from '../../src/utils/volume-unit';

describe('normalizeVolumeUnit', () => {
  it('normaliza variantes de galón', () => {
    expect(normalizeVolumeUnit('galones')).toBe('GALON');
    expect(normalizeVolumeUnit('galon')).toBe('GALON');
    expect(normalizeVolumeUnit('gallon')).toBe('GALON');
    expect(normalizeVolumeUnit('GAL')).toBe('GALON');
    expect(normalizeVolumeUnit('usg')).toBe('GALON');
  });

  it('normaliza variantes de litro', () => {
    expect(normalizeVolumeUnit('litros')).toBe('LITRO');
    expect(normalizeVolumeUnit('litro')).toBe('LITRO');
    expect(normalizeVolumeUnit('liter')).toBe('LITRO');
    expect(normalizeVolumeUnit('L')).toBe('LITRO');
  });

  it('devuelve null para vacío o desconocido', () => {
    expect(normalizeVolumeUnit(null)).toBeNull();
    expect(normalizeVolumeUnit('')).toBeNull();
    expect(normalizeVolumeUnit('  ')).toBeNull();
    expect(normalizeVolumeUnit('metros')).toBeNull();
  });
});

describe('conversión galones ↔ litros', () => {
  it('convierte galones a litros', () => {
    expect(galonesALitros(1)).toBeCloseTo(3.785411784, 9);
    expect(galonesALitros(20)).toBeCloseTo(20 * GALON_TO_LITROS, 9);
  });

  it('convierte litros a galones', () => {
    expect(litrosAGalones(GALON_TO_LITROS)).toBeCloseTo(1, 9);
  });

  it('round-trip es consistente', () => {
    const gal = 123.45;
    expect(litrosAGalones(galonesALitros(gal))).toBeCloseTo(gal, 6);
  });
});
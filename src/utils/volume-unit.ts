import type { UnidadVolumen } from '../domain/entities/product.entity';

const GALON_KEYWORDS = [
  'galon',
  'galones',
  'gallon',
  'gallons',
  'gal',
  'usg',
] as const;

const LITRO_KEYWORDS = [
  'litro',
  'litros',
  'liter',
  'liters',
  'lit',
  'l',
] as const;

/**
 * Normaliza el texto libre de `mangueras.unidad_medida` al enum canónico.
 * Devuelve null si la unidad es desconocida o está vacía.
 */
export function normalizeVolumeUnit(
  raw: string | null | undefined,
): UnidadVolumen | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (GALON_KEYWORDS.some((k) => value.includes(k))) return 'GALON';
  if (LITRO_KEYWORDS.some((k) => value.includes(k))) return 'LITRO';
  return null;
}

/** Factor de conversión: 1 galón US = 3.785411784 litros. */
export const GALON_TO_LITROS = 3.785411784;

/** Convierte litros a galones US. */
export function litrosAGalones(litros: number): number {
  return Number(litros) / GALON_TO_LITROS;
}

/** Convierte galones US a litros. */
export function galonesALitros(galones: number): number {
  return Number(galones) * GALON_TO_LITROS;
}
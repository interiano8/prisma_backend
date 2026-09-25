/**
 * Normaliza la URL del controlador (wayne): agrega http:// si falta, quita la
 * barra final y el sufijo /api si el operador lo escribió. Compartida entre
 * shift.service y dispenser-repository.
 */
export function normalizeControllerUrl(url: string): string {
  let u = url.trim();
  if (!u) return u;
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `http://${u}`;
  }
  if (u.endsWith('/')) {
    u = u.substring(0, u.length - 1);
  }
  if (u.endsWith('/api')) {
    u = u.substring(0, u.length - 4);
  }
  return u;
}

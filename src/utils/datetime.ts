/**
 * Utilidades de fecha/hora. Todo se genera con la fecha y hora del SERVIDOR
 * y se guarda en `timestamptz` (UTC con zona horaria).
 */

// Hora actual del servidor
export function serverNow(): Date {
  return new Date();
}

// Formatea un Date como la fecha/hora LOCAL del servidor, incluyendo el offset UTC
// (ej: 2026-08-15T14:30:00.000-06:00). Útil para mostrar "la hora del servidor".
export function toServerIso(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const off = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}${off}`
  );
}

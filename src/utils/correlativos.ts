export function padStoreId(storeId: string): string {
  const s = (storeId || '').trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10).toString().padStart(3, '0');
  return s;
}

export function nextInvoiceNumber(lastNoUsed: string): string {
  if (!lastNoUsed || lastNoUsed.length < 12) return lastNoUsed;
  const prefix = lastNoUsed.substring(0, 11);
  const num = parseInt(lastNoUsed.substring(11), 10);
  if (isNaN(num)) return lastNoUsed;
  return `${prefix}${String(num + 1).padStart(8, '0')}`;
}

export function nextTrId(lastNoUsed: string): string {
  if (!lastNoUsed || lastNoUsed.length < 7) return lastNoUsed;
  const prefix = lastNoUsed.substring(0, 6);
  const num = parseInt(lastNoUsed.substring(6), 10);
  if (isNaN(num)) return lastNoUsed;
  return `${prefix}${String(num + 1).padStart(11, '0')}`;
}

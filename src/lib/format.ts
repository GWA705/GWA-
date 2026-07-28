// Pure input-formatting helpers, safe for client components.

/** 705-716-2111 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/** L0L 2T0 (uppercase, single space in the middle) */
export function formatPostal(value: string): string {
  const c = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return c.length > 3 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

/** 000 000 000 */
export function formatSin(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 9);
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

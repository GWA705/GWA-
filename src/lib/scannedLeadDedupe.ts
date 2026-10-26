/**
 * Duplicate key for a scanned lead, so the same card can't be scanned in twice.
 *
 * Dependency-free (no 'use client', no 'server-only') so it can be shared. The
 * EXACT same normalisation is reproduced in the SQL backfill of the
 * 20261026020000_scanned_lead_dedupe migration — keep them in lockstep.
 *
 * Rule: a phone number is the strongest identity, so when there's a usable one
 * (≥7 digits) the key is the last 10 digits. Otherwise fall back to the
 * normalised name + the store number. Null only when there's neither — which the
 * save path already rejects.
 */
export function scannedLeadDedupeKey(parts: {
  phone?: string | null;
  customerName?: string | null;
  storeNumber?: string | null;
}): string | null {
  const digits = (parts.phone || '').replace(/\D/g, '');
  if (digits.length >= 7) return `p:${digits.slice(-10)}`;
  const name = (parts.customerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (name) return `n:${name}|s:${(parts.storeNumber || '').trim()}`;
  return null;
}

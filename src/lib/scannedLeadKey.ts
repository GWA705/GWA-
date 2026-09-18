/**
 * Stable key for a scanned lead's follow-up calls in the shared LeadCall store
 * (the same table the Home Depot leads use). Kept in its own dependency-free
 * module — no 'use client', no 'server-only' — so both the server leads pages and
 * the client ScannedLeadsList can import it.
 */
export function scannedLeadKey(id: string): string {
  return `scanned:${id}`;
}

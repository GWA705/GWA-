/**
 * Coarse status group for a mail-in (HD Mail In Test) card — new / working /
 * spoke / booked / sold / nogood — derived from its logged calls plus the card's
 * own No-good status. In its own dependency-free module (no 'use client', no
 * 'server-only') so BOTH the client workspace and the server-rendered merged
 * "All" view can call the real function; exporting it from a 'use client' module
 * would hand the server a client reference it can't invoke.
 */
export function scannedGroupKey(status: string, calls: { outcome: string }[]): string {
  if (status === 'NO_GOOD') return 'nogood';
  if (calls.length === 0) return 'new';
  const last = calls[calls.length - 1].outcome;
  if (last === 'SOLD') return 'sold';
  if (last === 'BOOKED') return 'booked';
  if (last === 'SPOKE') return 'spoke';
  if (last === 'NOT_INTERESTED') return 'nogood';
  return 'working'; // LEFT_MESSAGE / NO_ANSWER / notes
}

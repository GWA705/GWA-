/**
 * Decode the common HTML entities Gmail puts in message snippets/subjects
 * (e.g. `&#39;` → `'`, `&amp;` → `&`, `&quot;` → `"`), plus any numeric entity.
 * Gmail returns snippets HTML-encoded; shown raw they read as "you&#39;re".
 * Client-safe (no server-only).
 */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export function decodeEntities(input: string | null | undefined): string {
  const s = input ?? '';
  if (!s || s.indexOf('&') === -1) return s;
  return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (m, code: string) => {
    const c = code.toLowerCase();
    if (c[0] === '#') {
      const num = c[1] === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      if (Number.isFinite(num) && num > 0 && num <= 0x10ffff) {
        try { return String.fromCodePoint(num); } catch { return m; }
      }
      return m;
    }
    return NAMED[c] ?? m;
  });
}

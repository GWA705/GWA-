/**
 * Reconciling the store→dealer routing sheet against the portal (the live
 * master). "Pull from sheet" reads the sheet, diffs it against the database, and
 * shows exactly what WOULD change before anything is applied — so a stray edit in
 * the sheet can never silently reroute leads. Pure + no IO so it's unit-testable.
 */

export interface RoutingRow {
  number: string; // HD store number (digits)
  city: string;
  dealerName: string;
  active: boolean;
}

export type RoutingChange =
  | { kind: 'move'; number: string; city: string; from: string; to: string }
  | { kind: 'add'; number: string; city: string; to: string }
  | { kind: 'activate'; number: string; dealerName: string }
  | { kind: 'deactivate'; number: string; dealerName: string; reason: 'sheet' | 'missing' };

const num = (s: string): string => (String(s ?? '').match(/\d{3,}/)?.[0] ?? '').trim();
const normName = (s: string): string => String(s ?? '').trim().toLowerCase();

/**
 * Changes to bring the portal in line with the sheet. Never deletes: a store the
 * sheet dropped is DEACTIVATED (reversible), and flagged with reason 'missing'.
 * `db` is the current portal mapping, `sheet` is what the sheet now says.
 */
export function diffRouting(db: RoutingRow[], sheet: RoutingRow[]): RoutingChange[] {
  const dbByNum = new Map<string, RoutingRow>();
  for (const r of db) {
    const k = num(r.number);
    if (k && !dbByNum.has(k)) dbByNum.set(k, r);
  }
  const sheetByNum = new Map<string, RoutingRow>();
  for (const r of sheet) {
    const k = num(r.number);
    if (k && normName(r.dealerName) && !sheetByNum.has(k)) sheetByNum.set(k, { ...r, number: k });
  }

  const changes: RoutingChange[] = [];

  for (const [k, s] of sheetByNum) {
    const d = dbByNum.get(k);
    if (!d) {
      changes.push({ kind: 'add', number: k, city: s.city.trim(), to: s.dealerName.trim() });
      continue;
    }
    if (normName(s.dealerName) !== normName(d.dealerName)) {
      changes.push({ kind: 'move', number: k, city: s.city.trim() || d.city, from: d.dealerName, to: s.dealerName.trim() });
    }
    if (s.active !== d.active) {
      changes.push(
        s.active
          ? { kind: 'activate', number: k, dealerName: d.dealerName }
          : { kind: 'deactivate', number: k, dealerName: d.dealerName, reason: 'sheet' },
      );
    }
  }

  // A store that's still active in the portal but no longer in the sheet → the
  // sheet dropped it. Deactivate (reversible), clearly flagged for review.
  for (const [k, d] of dbByNum) {
    if (d.active && !sheetByNum.has(k)) {
      changes.push({ kind: 'deactivate', number: k, dealerName: d.dealerName, reason: 'missing' });
    }
  }

  return changes;
}

/** One-line human summary of a change, for the preview list. */
export function describeChange(c: RoutingChange): string {
  switch (c.kind) {
    case 'move':
      return `Store ${c.number}${c.city ? ` (${c.city})` : ''}: ${c.from} → ${c.to}`;
    case 'add':
      return `Add store ${c.number}${c.city ? ` (${c.city})` : ''} → ${c.to}`;
    case 'activate':
      return `Reactivate store ${c.number} (${c.dealerName})`;
    case 'deactivate':
      return c.reason === 'missing'
        ? `Deactivate store ${c.number} (${c.dealerName}) — no longer in the sheet`
        : `Deactivate store ${c.number} (${c.dealerName})`;
  }
}

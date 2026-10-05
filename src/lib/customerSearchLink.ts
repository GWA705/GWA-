/**
 * Linking a sales-journal row to its portal deal.
 *
 * A journal row is tied to a portal Application by the tab + row the portal
 * recorded when it wrote (or matched) the deal. That pointer is not guaranteed
 * unique: a row can end up pointed at by more than one Application — a duplicate
 * deal, or a pointer the journal self-heal re-assigned to a different row. If the
 * search picked whichever Application came back first (unordered) it could
 * attach the WRONG customer's email / contact-override to the row, and a
 * different one on each request — the "same customer, different number every
 * time" bug.
 *
 * These are pure helpers (no DB / no server-only) so the rule is unit-testable.
 */

/** Normalize a last name for identity comparison: letters only, lower-cased. */
export function normLastName(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

export interface LinkCandidate {
  id: string;
  applicantLastName: string;
  applicantEmail: string | null;
}

/**
 * Choose the portal deal to link to a journal row, or null if none should link.
 *
 *  - Only a deal whose last name matches the journal row's is eligible — so a
 *    deal mis-pointed at this row never bleeds its email/contact into it.
 *  - `candidates` must be ordered newest-first; the first eligible one wins, so
 *    the choice is deterministic and the same search always shows the same deal.
 */
export function pickLinkedApp(candidates: LinkCandidate[], rowLastName: string): LinkCandidate | null {
  const want = normLastName(rowLastName);
  if (!want) return null;
  return candidates.find((a) => normLastName(a.applicantLastName) === want) ?? null;
}

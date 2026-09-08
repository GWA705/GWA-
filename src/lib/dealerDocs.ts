// Shared, framework-agnostic helpers for dealer business documents — the
// expiry status used by the dealer page, the admin compliance view, and the
// reminder engine. Pure functions only (safe to import anywhere).

export type DocStatus = 'missing' | 'valid' | 'expiring' | 'expired';

/** How soon (days) an expiry is flagged "expiring soon" in the UI. */
export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 86_400_000;

/** Whole days from now until the expiry (negative once past). */
export function daysUntil(expiry: Date | null | undefined, now: Date = new Date()): number | null {
  if (!expiry) return null;
  const end = new Date(expiry).setHours(0, 0, 0, 0);
  const start = new Date(now).setHours(0, 0, 0, 0);
  return Math.round((end - start) / DAY_MS);
}

export function docStatus(
  expiry: Date | null | undefined,
  now: Date = new Date(),
  soonDays: number = EXPIRING_SOON_DAYS,
): { status: DocStatus; daysLeft: number | null } {
  const daysLeft = daysUntil(expiry, now);
  if (daysLeft === null) return { status: 'missing', daysLeft: null };
  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= soonDays) return { status: 'expiring', daysLeft };
  return { status: 'valid', daysLeft };
}

/** Short human phrase for a status + days-left, e.g. "Expires in 5 days". */
export function statusLabel(status: DocStatus, daysLeft: number | null): string {
  switch (status) {
    case 'missing':
      return 'Not uploaded';
    case 'expired':
      return daysLeft === null ? 'Expired' : `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
    case 'expiring':
      if (daysLeft === 0) return 'Expires today';
      return `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    case 'valid':
    default:
      return daysLeft === null ? 'Current' : `Valid — ${daysLeft} days left`;
  }
}

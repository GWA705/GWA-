/**
 * Pure, dependency-free helpers for "which weekdays may we send follow-up texts".
 *
 * The welcome/confirmation text always goes out (any day). But the reminder
 * sequence — day-1, missed-window, reactivation — should only fire on days the
 * office actually has booking staff, so a lead that lands Friday–Sunday isn't
 * nudged with "a team member will call you" until someone is back to call.
 *
 * No `server-only` import here so the admin settings form (client) and the sweep
 * (server) can share the same weekday list and labels.
 *
 * Weekday numbers follow JS `Date.getDay()` / Intl: 0 = Sunday … 6 = Saturday.
 */

export interface Weekday {
  n: number;
  short: string;
  long: string;
}

// Display order Monday-first (how a Canadian work week reads); `n` is the
// Intl/getDay() index so it lines up with localWeekday() below.
export const WEEKDAYS: Weekday[] = [
  { n: 1, short: 'Mon', long: 'Monday' },
  { n: 2, short: 'Tue', long: 'Tuesday' },
  { n: 3, short: 'Wed', long: 'Wednesday' },
  { n: 4, short: 'Thu', long: 'Thursday' },
  { n: 5, short: 'Fri', long: 'Friday' },
  { n: 6, short: 'Sat', long: 'Saturday' },
  { n: 0, short: 'Sun', long: 'Sunday' },
];

// Mon–Fri — the sensible default working week.
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

/** Parse a stored "1,2,3,4,5" into a Set of weekday numbers (Mon–Fri default). */
export function parseWorkdays(raw?: string | null): Set<number> {
  if (raw == null || raw === '') return new Set(DEFAULT_WORKDAYS);
  const nums = raw
    .split(/[,\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const set = new Set(nums);
  return set.size ? set : new Set(DEFAULT_WORKDAYS);
}

/** Serialize a set/list of weekday numbers back to a stable "0,1,2" string. */
export function serializeWorkdays(days: Iterable<number>): string {
  return Array.from(new Set(Array.from(days)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b)
    .join(',');
}

// Intl short-weekday → number, so the "working day" test is in the customer's
// local timezone (a Saturday-evening lead in BC isn't treated as Sunday server-side).
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Weekday (0=Sun … 6=Sat) of `now` in the given IANA timezone. */
export function localWeekday(now: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  return WD_INDEX[wd] ?? now.getUTCDay();
}

/** Is `now` (in `tz`) one of the configured working days? */
export function isWorkday(now: Date, tz: string, workdays: Set<number>): boolean {
  return workdays.has(localWeekday(now, tz));
}

/** Human summary like "Mon–Fri", "Mon, Wed, Fri", "every day", or "no days". */
export function workdaysLabel(workdays: Set<number>): string {
  const on = WEEKDAYS.filter((w) => workdays.has(w.n));
  if (on.length === 0) return 'no days';
  if (on.length === 7) return 'every day';
  // Collapse a contiguous Mon-first run to "Mon–Fri" form.
  const idxs = on.map((w) => WEEKDAYS.findIndex((x) => x.n === w.n)).sort((a, b) => a - b);
  const contiguous = idxs.every((v, i) => i === 0 || v === idxs[i - 1] + 1);
  if (contiguous && on.length >= 3) {
    return `${WEEKDAYS[idxs[0]].short}–${WEEKDAYS[idxs[idxs.length - 1]].short}`;
  }
  return on.map((w) => w.short).join(', ');
}

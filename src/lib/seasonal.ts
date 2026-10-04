/**
 * Seasonal theming windows. Dates are evaluated in America/Toronto so a look
 * flips at LOCAL midnight (not UTC), and the check is pure so it can be unit
 * tested. Callers decide on the server (e.g. the sign-in page) so there's no
 * flash of the wrong theme.
 */

// The Halloween look runs from this day of October through Oct 31, and reverts
// on its own on November 1 (November simply isn't October). Change this one
// number to start it earlier/later in the month.
export const SPOOKY_START_DAY = 24;

function torontoMonthDay(date: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { month, day };
}

/** True during the Halloween window (Oct SPOOKY_START_DAY–31, Toronto time). */
export function isSpookySeason(date: Date = new Date()): boolean {
  const { month, day } = torontoMonthDay(date);
  return month === 10 && day >= SPOOKY_START_DAY;
}

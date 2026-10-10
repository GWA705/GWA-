/**
 * Self-booking time-window labels and helpers. Dependency-free (no 'server-only',
 * no prisma) so both the client booking form and the server code can import it.
 * The token/URL/DB helpers live in leadBooking.ts (server-only).
 */

export const BOOKING_WINDOWS = ['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME'] as const;
export type BookingWindow = (typeof BOOKING_WINDOWS)[number];

export const BOOKING_WINDOW_LABEL: Record<string, string> = {
  MORNING: 'Morning (8am–12pm)',
  AFTERNOON: 'Afternoon (12–5pm)',
  EVENING: 'Evening (5–8pm)',
  ANYTIME: 'Any time',
};
export const BOOKING_WINDOW_SHORT: Record<string, string> = {
  MORNING: 'AM', AFTERNOON: 'PM', EVENING: 'Eve', ANYTIME: 'Any',
};

export function isBookingWindow(v: string): v is BookingWindow {
  return (BOOKING_WINDOWS as readonly string[]).includes(v);
}

// A short, human label for a requested slot, e.g. "Tue Oct 14 · PM".
export function bookingRequestLabel(day: string | null | undefined, window: string | null | undefined): string {
  let dayLabel = '';
  if (day) {
    const d = new Date(`${day}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      dayLabel = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }
  const win = window ? BOOKING_WINDOW_SHORT[window] ?? window : '';
  return [dayLabel, win].filter(Boolean).join(' · ') || 'a time';
}

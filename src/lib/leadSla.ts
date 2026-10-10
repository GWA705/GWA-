/**
 * Lead response SLA — how a scanned/mail-in lead is tracking against the 24-48 hr
 * "a team member will call you" promise made in the confirmation text.
 *
 * Dependency-free (no 'server-only' / 'use client') so both the server leads pages
 * and the client ScannedLeadsList can import it. The clock starts when the lead
 * lands (createdAt) and stops the moment the lead is worked — contacted/no-good by
 * the office, or moved by a booker (bookingStatus set). A worked or closed lead
 * has no SLA state (returns null); only still-open leads that are approaching or
 * past the window are flagged, so the list draws the eye to what needs a call now.
 */

export type LeadSlaState = 'DUE_SOON' | 'OVERDUE';

export interface LeadSla {
  state: LeadSlaState;
  tone: 'amber' | 'red';
  label: string; // e.g. "Overdue · 2d"
  ageHours: number;
}

// Default thresholds, matching the 24-48 hr call promise.
export const SLA_WARN_HOURS = 24;
export const SLA_OVERDUE_HOURS = 48;

function fmtAge(hours: number): string {
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function leadSla(input: {
  createdAt: Date | string;
  status: string;
  bookingStatus?: string | null;
  now?: Date;
  warnHours?: number;
  overdueHours?: number;
}): LeadSla | null {
  // Worked or closed → no SLA to track. Any status other than NEW means the
  // office acted; any bookingStatus means a booker has it.
  if (input.status !== 'NEW') return null;
  if (input.bookingStatus) return null;

  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  const t = created.getTime();
  if (!Number.isFinite(t)) return null;

  const now = input.now ?? new Date();
  const warn = input.warnHours ?? SLA_WARN_HOURS;
  const overdue = input.overdueHours ?? SLA_OVERDUE_HOURS;
  const ageHours = (now.getTime() - t) / (60 * 60 * 1000);

  if (ageHours >= overdue) return { state: 'OVERDUE', tone: 'red', label: `Overdue · ${fmtAge(ageHours)}`, ageHours };
  if (ageHours >= warn) return { state: 'DUE_SOON', tone: 'amber', label: `Due soon · ${fmtAge(ageHours)}`, ageHours };
  return null;
}

import type { ResolutionStatus } from '@prisma/client';

// Pure, client-safe constants for the HD Resolution Centre (no server-only /
// prisma imports) so both server pages and client components can use them.

export const RESOLUTION_STATUSES: ResolutionStatus[] = [
  'OPEN', 'IN_PROGRESS', 'WAITING_ON_OFFICE', 'ESCALATED_HD', 'RESOLVED', 'CLOSED',
];
/** Statuses that count as "still live" (default queue view, age-coloured). */
export const OPEN_STATUSES: ResolutionStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_OFFICE', 'ESCALATED_HD'];

export const STATUS_LABEL: Record<ResolutionStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_OFFICE: 'Waiting on office',
  ESCALATED_HD: 'Escalated to HD',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export type StatusTone = 'open' | 'prog' | 'wait' | 'esc' | 'done' | 'closed';
export const STATUS_TONE: Record<ResolutionStatus, StatusTone> = {
  OPEN: 'open',
  IN_PROGRESS: 'prog',
  WAITING_ON_OFFICE: 'wait',
  ESCALATED_HD: 'esc',
  RESOLVED: 'done',
  CLOSED: 'closed',
};

/** Tailwind classes per status tone — meaning-coded, light + dark. */
export const TONE_CLASS: Record<StatusTone, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-900/30 dark:text-blue-300',
  prog: 'bg-orange-50 text-orange-700 border-orange-500 dark:bg-orange-900/30 dark:text-orange-300',
  wait: 'bg-amber-50 text-amber-700 border-amber-500 dark:bg-amber-900/30 dark:text-amber-300',
  esc: 'bg-red-50 text-red-700 border-red-500 dark:bg-red-900/30 dark:text-red-300',
  done: 'bg-green-50 text-green-700 border-green-600 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-500 border-gray-400 dark:bg-gray-700/50 dark:text-gray-400',
};

export function statusChipClass(status: ResolutionStatus): string {
  return `inline-flex items-center gap-1 rounded-md border-l-4 px-2 py-[3px] text-xs font-bold leading-none whitespace-nowrap ${TONE_CLASS[STATUS_TONE[status]]}`;
}

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export function isResolutionStatus(v: string): v is ResolutionStatus {
  return (RESOLUTION_STATUSES as string[]).includes(v);
}

/** Aging: amber at 3 days open, red at 7 — open (not resolved/closed) cases only. */
export type AgeLevel = 'none' | 'amber' | 'red';
export function ageLevel(openedAt: Date, status: ResolutionStatus): AgeLevel {
  if (!OPEN_STATUSES.includes(status)) return 'none';
  const days = (Date.now() - openedAt.getTime()) / 86_400_000;
  if (days >= 7) return 'red';
  if (days >= 3) return 'amber';
  return 'none';
}

import type { ApplicationStatus } from '@prisma/client';

/**
 * Status / action chip styling — one shared system so every badge reads the same.
 *
 * The old palette gave a near-unique colour to each of twelve statuses, mostly in
 * the same blue-green zone, so a quick scan couldn't tell them apart. This maps
 * every status (and every reviewer-queue "tone") to one of SEVEN meaning buckets,
 * each a clearly distinct, bolder hue:
 *   urgent (act now) · new (to approve) · desk (on your desk) ·
 *   wait (with the dealer) · fund (money stage) · done · dead (closed)
 *
 * Two shapes: a loud SOLID tag for the "what to do" action chip, and a soft
 * LEFT-BAR chip for the status badge. Colour carries meaning; the label carries
 * the exact stage; an icon + shape keep it readable for colour-blind viewers.
 */

export type ChipBucket = 'urgent' | 'new' | 'desk' | 'wait' | 'fund' | 'done' | 'dead';

export const STATUS_BUCKET: Record<ApplicationStatus, ChipBucket> = {
  DRAFT: 'dead',
  SUBMITTED: 'new',
  UNDER_REVIEW: 'desk',
  CONDITIONAL: 'wait',
  APPROVED: 'wait',
  DOCS_SENT: 'wait',
  DECLINED: 'dead',
  FUNDING_SUBMITTED: 'desk',
  FUNDING_REVIEW: 'fund',
  FUNDED: 'done',
  PROBLEM: 'urgent',
  WITHDRAWN: 'dead',
};

// Reviewer-queue "tone" (the action/activity chips) → bucket.
export const TONE_BUCKET: Record<string, ChipBucket> = {
  new: 'new',
  review: 'desk',
  note: 'desk',
  fund: 'fund',
  funded: 'done',
  paid: 'done',
  appr: 'wait',
  sent: 'wait',
  prob: 'urgent',
  decl: 'wait',
};

// System A — solid tag: saturated fill, white bold text, rectangular.
const SOLID: Record<ChipBucket, string> = {
  urgent: 'bg-red-600 text-white',
  new: 'bg-blue-600 text-white',
  desk: 'bg-orange-600 text-white',
  wait: 'bg-slate-500 text-white',
  fund: 'bg-violet-600 text-white',
  done: 'bg-green-600 text-white',
  dead: 'bg-gray-500 text-white',
};

// System B — left-bar chip: soft tint, dark bold text, a thick colour bar.
const BAR: Record<ChipBucket, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-500 dark:bg-red-900/30 dark:text-red-300',
  new: 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-900/30 dark:text-blue-300',
  desk: 'bg-orange-50 text-orange-700 border-orange-500 dark:bg-orange-900/30 dark:text-orange-300',
  wait: 'bg-slate-100 text-slate-600 border-slate-400 dark:bg-slate-700/50 dark:text-slate-300',
  fund: 'bg-violet-50 text-violet-700 border-violet-500 dark:bg-violet-900/30 dark:text-violet-300',
  done: 'bg-green-50 text-green-700 border-green-600 dark:bg-green-900/30 dark:text-green-300',
  dead: 'bg-gray-100 text-gray-500 border-gray-400 dark:bg-gray-700/50 dark:text-gray-400',
};

export function solidChipClass(b: ChipBucket): string {
  return `inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-xs font-bold leading-none whitespace-nowrap ${SOLID[b]}`;
}
export function barChipClass(b: ChipBucket): string {
  return `inline-flex items-center gap-1 rounded-md border-l-4 px-2 py-[3px] text-xs font-bold leading-none whitespace-nowrap ${BAR[b]}`;
}

/** A tiny meaning icon per bucket (functional, reinforces colour for quick scan). */
export function BucketIcon({ bucket }: { bucket: ChipBucket }) {
  const common = { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (bucket) {
    case 'urgent':
      return <svg {...common}><path d="M12 8v5" /><path d="M12 16.5h.01" /><path d="M10.3 3.3 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.3a2 2 0 0 0-3.4 0Z" /></svg>;
    case 'new':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'desk':
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.6" /></svg>;
    case 'wait':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></svg>;
    case 'fund':
      return <svg {...common}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
    case 'done':
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    default:
      return <svg {...common}><path d="M5 12h14" /></svg>;
  }
}

import 'server-only';
import { prisma } from '@/lib/db';
import type { ApplicationStatus } from '@prisma/client';

/**
 * Review cycle-time reporting. Every status change is timestamped in StatusEvent,
 * so we can measure how long a deal spends between the milestones of the pipeline
 * — "how long from approved to install docs sent", etc. — and aggregate across a
 * cohort of deals to spot where time is really going.
 *
 * The cohort is the deals SUBMITTED within the window. Later stages naturally
 * have fewer samples (recent deals haven't reached them yet), so every row shows
 * its own count — read medians alongside n, not in isolation.
 */

export interface TaskStat {
  key: string;
  label: string;
  kind: 'reviewer' | 'dealer' | 'total';
  count: number;
  medianMs: number | null;
  avgMs: number | null;
  p90Ms: number | null;
}

export interface CycleTimesResult {
  tasks: TaskStat[];
  dealsConsidered: number;
  since: Date | null;
}

type EventLite = { to: ApplicationStatus; createdAt: Date };

/** Earliest time the deal entered the given status (null if it never did). */
function enterTime(events: EventLite[], status: ApplicationStatus): Date | null {
  let best: Date | null = null;
  for (const e of events) {
    if (e.to === status && (best === null || e.createdAt < best)) best = e.createdAt;
  }
  return best;
}

/** First defined value in priority order (for a from-stage with fallbacks). */
function firstDefined(times: (Date | null)[]): Date | null {
  for (const t of times) if (t) return t;
  return null;
}

/** Earliest of several times (for a to-stage that could be any of several). */
function earliest(times: (Date | null)[]): Date | null {
  let best: Date | null = null;
  for (const t of times) if (t && (best === null || t < best)) best = t;
  return best;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function mean(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}
function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

// The pipeline tasks we measure. `from`/`to` are matched against each deal's
// status history. `from` is a priority fallback list (use the first that
// happened); `to` is the earliest of the listed milestones (whichever came).
interface TaskDef {
  key: string;
  label: string;
  kind: 'reviewer' | 'dealer' | 'total';
  from: 'submitted' | ApplicationStatus[];
  to: 'paid' | ApplicationStatus[];
}

const TASKS: TaskDef[] = [
  { key: 'triage', label: 'Submitted → Start review', kind: 'reviewer', from: 'submitted', to: ['UNDER_REVIEW'] },
  { key: 'review', label: 'Under review → Decision', kind: 'reviewer', from: ['UNDER_REVIEW'], to: ['APPROVED', 'CONDITIONAL', 'DECLINED'] },
  { key: 'produce', label: 'Approved → Install docs sent', kind: 'reviewer', from: ['APPROVED', 'CONDITIONAL'], to: ['DOCS_SENT'] },
  { key: 'dealer', label: 'Docs sent → Signed package back', kind: 'dealer', from: ['DOCS_SENT'], to: ['FUNDING_SUBMITTED'] },
  { key: 'fundpickup', label: 'Package back → In for funding', kind: 'reviewer', from: ['FUNDING_SUBMITTED'], to: ['FUNDING_REVIEW'] },
  { key: 'funded', label: 'In for funding → Funded', kind: 'reviewer', from: ['FUNDING_REVIEW', 'FUNDING_SUBMITTED'], to: ['FUNDED'] },
  { key: 'paid', label: 'Funded → Dealer paid', kind: 'reviewer', from: ['FUNDED'], to: 'paid' },
  { key: 'total', label: 'Overall (Submitted → Funded)', kind: 'total', from: 'submitted', to: ['FUNDED'] },
];

export async function computeCycleTimes(since: Date | null): Promise<CycleTimesResult> {
  const apps = await prisma.application.findMany({
    where: {
      status: { not: 'DRAFT' },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      id: true,
      createdAt: true,
      statusEvents: { select: { to: true, createdAt: true } },
      payouts: { select: { paidOn: true } },
    },
  });

  // Collect each task's durations (ms) across the cohort.
  const samples: Record<string, number[]> = Object.fromEntries(TASKS.map((t) => [t.key, []]));

  for (const app of apps) {
    const ev = app.statusEvents;
    const submitted = enterTime(ev, 'SUBMITTED') ?? app.createdAt;
    const paid = app.payouts.length
      ? app.payouts.reduce<Date>((min, p) => (p.paidOn < min ? p.paidOn : min), app.payouts[0].paidOn)
      : null;

    const startOf = (from: TaskDef['from']): Date | null =>
      from === 'submitted' ? submitted : firstDefined(from.map((s) => enterTime(ev, s)));
    const endOf = (to: TaskDef['to']): Date | null =>
      to === 'paid' ? paid : earliest(to.map((s) => enterTime(ev, s)));

    for (const t of TASKS) {
      const start = startOf(t.from);
      const end = endOf(t.to);
      if (start && end) {
        const ms = end.getTime() - start.getTime();
        if (ms >= 0) samples[t.key].push(ms);
      }
    }
  }

  const tasks: TaskStat[] = TASKS.map((t) => {
    const xs = samples[t.key];
    return {
      key: t.key,
      label: t.label,
      kind: t.kind,
      count: xs.length,
      medianMs: median(xs),
      avgMs: mean(xs),
      p90Ms: percentile(xs, 90),
    };
  });

  return { tasks, dealsConsidered: apps.length, since };
}

/** Human-readable duration, e.g. "2d 8h", "5h 12m", "43m", "<1m", "—". */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '<1m';
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

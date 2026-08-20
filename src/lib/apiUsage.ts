import { prisma } from './db';

/**
 * Metering for billable outside-service calls (currently the Google address
 * lookup API). Each real call bumps a per-day counter; the admin Costs page sums
 * these by month and prices them. Best-effort: a metering failure must never
 * break the underlying lookup, so recordApiUsage swallows its own errors.
 */

export const API_SERVICES = {
  googleAutocomplete: 'google_places_autocomplete',
  googleDetails: 'google_places_details',
} as const;

export type ApiService = (typeof API_SERVICES)[keyof typeof API_SERVICES];

/** UTC 'YYYY-MM-DD' for a date (defaults to now). */
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** UTC 'YYYY-MM' month key for a date (defaults to now). */
export function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/** Record one billable call. Fire-and-forget — never throws to the caller. */
export async function recordApiUsage(service: ApiService, when: Date = new Date()): Promise<void> {
  const day = dayKey(when);
  try {
    await prisma.apiUsage.upsert({
      where: { service_day: { service, day } },
      create: { service, day, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (err) {
    console.error('[apiUsage] failed to record', service, err);
  }
}

export interface MonthUsage {
  month: string; // 'YYYY-MM'
  counts: Record<string, number>; // service → calls this month
}

/** Total calls per service for a given month (defaults to the current month). */
export async function usageForMonth(month: string = monthKey()): Promise<MonthUsage> {
  const rows = await prisma.apiUsage.findMany({ where: { day: { startsWith: month } } });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.service] = (counts[r.service] ?? 0) + r.count;
  return { month, counts };
}

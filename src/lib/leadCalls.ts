import 'server-only';
import { prisma } from './db';

// The outcomes a call can have. NOTE is a plain note with no outcome.
export const LEAD_CALL_OUTCOMES = [
  'NO_ANSWER',
  'LEFT_MESSAGE',
  'SPOKE',
  'BOOKED',
  'NOT_INTERESTED',
  'NOTE',
] as const;
export type LeadCallOutcome = (typeof LEAD_CALL_OUTCOMES)[number];

export interface LeadCallRow {
  id: string;
  outcome: string;
  note: string | null;
  actorName: string | null;
  createdAt: string; // ISO, for the client component
}

/** Fetch all call records for a set of lead keys, grouped by key (newest last). */
export async function readLeadCalls(keys: string[]): Promise<Record<string, LeadCallRow[]>> {
  const out: Record<string, LeadCallRow[]> = {};
  if (keys.length === 0) return out;
  try {
    const rows = await prisma.leadCall.findMany({
      where: { leadKey: { in: keys } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, leadKey: true, outcome: true, note: true, actorName: true, createdAt: true },
    });
    for (const r of rows) {
      (out[r.leadKey] ??= []).push({
        id: r.id,
        outcome: r.outcome,
        note: r.note,
        actorName: r.actorName,
        createdAt: r.createdAt.toISOString(),
      });
    }
  } catch {
    // Table not present yet (migration rolling out) — show no history rather
    // than crashing the leads page.
    return {};
  }
  return out;
}

/** Derive the at-a-glance status from a lead's call history. */
export function leadCallStatus(calls: { outcome: string }[]): {
  tone: 'grey' | 'amber' | 'red' | 'teal' | 'green';
  label: string;
  next: string | null;
} {
  if (calls.length === 0) return { tone: 'grey', label: 'Not called', next: 'Call now' };
  const noAns = calls.filter((c) => c.outcome === 'NO_ANSWER').length;
  const last = calls[calls.length - 1].outcome;
  switch (last) {
    case 'BOOKED': return { tone: 'green', label: 'Booked', next: null };
    case 'NOT_INTERESTED': return { tone: 'grey', label: 'Not interested', next: null };
    case 'SPOKE': return { tone: 'teal', label: 'Spoke', next: 'Follow up / book' };
    case 'LEFT_MESSAGE': return { tone: 'amber', label: 'Left message', next: 'Follow up' };
    case 'NO_ANSWER':
      return noAns >= 2
        ? { tone: 'red', label: `${noAns} attempts · no answer`, next: 'Call another time' }
        : { tone: 'amber', label: '1 attempt · no answer', next: 'Try again' };
    default:
      return { tone: 'grey', label: 'Note logged', next: 'Follow up' };
  }
}

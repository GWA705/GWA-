import 'server-only';
import { prisma } from './db';

// The outcomes a call can have. NOTE is a plain note with no outcome.
export const LEAD_CALL_OUTCOMES = [
  'NO_ANSWER',
  'LEFT_MESSAGE',
  'SPOKE',
  'BOOKED',
  'SOLD',
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
/**
 * Compact call-status for a lead: colour tone, a short label and the suggested
 * next step. Pass `t` (from the i18n dictionary) to get localized label/next;
 * without it the English strings are returned (safe for any non-UI use).
 */
export function leadCallStatus(
  calls: { outcome: string }[],
  t?: (key: string, vars?: Record<string, string | number>) => string,
): {
  tone: 'grey' | 'amber' | 'red' | 'teal' | 'green' | 'violet';
  label: string;
  next: string | null;
} {
  const L = (key: string, en: string, vars?: Record<string, string | number>) => (t ? t(`leads.${key}`, vars) : en);
  if (calls.length === 0) return { tone: 'grey', label: L('csNew', 'New'), next: L('nextCallNow', 'Call now') };
  const noAns = calls.filter((c) => c.outcome === 'NO_ANSWER').length;
  const last = calls[calls.length - 1].outcome;
  switch (last) {
    case 'SOLD': return { tone: 'violet', label: L('csSold', 'Sold'), next: null };
    case 'BOOKED': return { tone: 'green', label: L('csBooked', 'Booked'), next: null };
    case 'NOT_INTERESTED': return { tone: 'grey', label: L('csNoInterest', 'No interest'), next: null };
    case 'SPOKE': return { tone: 'teal', label: L('csSpoke', 'Spoke'), next: L('nextFollowUpBook', 'Follow up / book') };
    case 'LEFT_MESSAGE': return { tone: 'amber', label: L('csMsgLeft', 'Msg left'), next: L('nextFollowUp', 'Follow up') };
    case 'NO_ANSWER':
      return noAns >= 2
        ? { tone: 'red', label: L('csNoAnswerN', `No answer ×${noAns}`, { n: noAns }), next: L('nextCallAnother', 'Call another time') }
        : { tone: 'amber', label: L('csNoAnswer', 'No answer'), next: L('nextTryAgain', 'Try again') };
    default:
      return { tone: 'grey', label: L('csNote', 'Note'), next: L('nextFollowUp', 'Follow up') };
  }
}

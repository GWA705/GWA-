import 'server-only';
import { prisma } from '@/lib/db';
import { readLeads, leadKeyOf, type Lead } from '@/lib/leads';
import { readLeadCalls } from '@/lib/leadCalls';

/**
 * The Leads report: everything worth knowing about HD leads, grouped by the
 * dealer that owns the store the lead came into. Combines three sources —
 * the HD Leads Log sheet (leads + No-Good flag), the store→dealer mapping, and
 * the portal's call-tracking records (latest outcome per lead) — into one
 * per-dealer breakdown plus a group total.
 */

// The call-activity buckets we report, keyed by a lead's latest logged outcome.
export interface OutcomeCounts {
  notCalled: number;
  na: number; // No answer
  lm: number; // Left message
  spoke: number;
  booked: number;
  sold: number;
  ni: number; // Not interested
}

export interface DealerLeads {
  dealerId: string | null; // null = stores not assigned to any dealer
  dealerName: string;
  total: number;
  noGood: number;
  byKind: { kind: string; count: number }[];
  outcomes: OutcomeCounts;
}

export interface LeadsReport {
  configured: boolean;
  error?: string;
  generatedAt: string;
  group: {
    total: number;
    noGood: number;
    dealers: number;
    byKind: { kind: string; count: number }[];
    outcomes: OutcomeCounts;
  };
  dealers: DealerLeads[];
}

function emptyOutcomes(): OutcomeCounts {
  return { notCalled: 0, na: 0, lm: 0, spoke: 0, booked: 0, sold: 0, ni: 0 };
}

// The lead's latest meaningful outcome — a plain NOTE isn't an outcome, so we
// look past it to the last real call result.
export function latestOutcome(calls: { outcome: string }[]): keyof OutcomeCounts {
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    switch (calls[i].outcome) {
      case 'NO_ANSWER': return 'na';
      case 'LEFT_MESSAGE': return 'lm';
      case 'SPOKE': return 'spoke';
      case 'BOOKED': return 'booked';
      case 'SOLD': return 'sold';
      case 'NOT_INTERESTED': return 'ni';
      default: break; // NOTE — keep looking back
    }
  }
  return 'notCalled';
}

function kindOf(l: Lead): string {
  return (l.service || '').trim() || 'Unspecified';
}

function topKinds(map: Map<string, number>): { kind: string; count: number }[] {
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

export async function buildLeadsReport(generatedAtISO: string): Promise<LeadsReport> {
  const emptyGroup = { total: 0, noGood: 0, dealers: 0, byKind: [], outcomes: emptyOutcomes() };

  const read = await readLeads();
  if (!read.configured) {
    return { configured: false, generatedAt: generatedAtISO, group: emptyGroup, dealers: [] };
  }
  if (read.error) {
    return { configured: true, error: read.error, generatedAt: generatedAtISO, group: emptyGroup, dealers: [] };
  }

  // store number → dealer.
  const stores = await prisma.homeDepotStore.findMany({
    select: { number: true, dealer: { select: { id: true, name: true, profile: { select: { businessName: true } } } } },
  });
  const storeToDealer = new Map<string, { id: string; name: string }>();
  for (const s of stores) {
    const num = s.number.trim();
    if (!num || !s.dealer) continue;
    storeToDealer.set(num, { id: s.dealer.id, name: s.dealer.profile?.businessName || s.dealer.name });
  }

  // Latest call outcome per lead key.
  const leads = read.leads;
  const keys = Array.from(new Set(leads.map(leadKeyOf)));
  const callsByKey = await readLeadCalls(keys);

  // Accumulate per dealer.
  interface Acc {
    dealerId: string | null;
    dealerName: string;
    total: number;
    noGood: number;
    kinds: Map<string, number>;
    outcomes: OutcomeCounts;
  }
  const byDealer = new Map<string, Acc>();
  const groupKinds = new Map<string, number>();
  const groupOutcomes = emptyOutcomes();
  let groupNoGood = 0;

  for (const l of leads) {
    const d = storeToDealer.get((l.storeNumber || '').trim());
    const dealerId = d?.id ?? null;
    const dealerName = d?.name ?? 'Unassigned (unknown store)';
    const bucketKey = dealerId ?? '__unassigned__';
    let acc = byDealer.get(bucketKey);
    if (!acc) {
      acc = { dealerId, dealerName, total: 0, noGood: 0, kinds: new Map(), outcomes: emptyOutcomes() };
      byDealer.set(bucketKey, acc);
    }

    acc.total += 1;
    const kind = kindOf(l);
    acc.kinds.set(kind, (acc.kinds.get(kind) ?? 0) + 1);
    groupKinds.set(kind, (groupKinds.get(kind) ?? 0) + 1);

    if (l.noGood) { acc.noGood += 1; groupNoGood += 1; }

    const bucket = latestOutcome(callsByKey[leadKeyOf(l)] ?? []);
    acc.outcomes[bucket] += 1;
    groupOutcomes[bucket] += 1;
  }

  const dealers: DealerLeads[] = [...byDealer.values()]
    .map((a) => ({
      dealerId: a.dealerId,
      dealerName: a.dealerName,
      total: a.total,
      noGood: a.noGood,
      byKind: topKinds(a.kinds),
      outcomes: a.outcomes,
    }))
    .sort((a, b) => b.total - a.total || a.dealerName.localeCompare(b.dealerName));

  return {
    configured: true,
    generatedAt: generatedAtISO,
    group: {
      total: leads.length,
      noGood: groupNoGood,
      dealers: dealers.filter((d) => d.dealerId).length,
      byKind: topKinds(groupKinds),
      outcomes: groupOutcomes,
    },
    dealers,
  };
}

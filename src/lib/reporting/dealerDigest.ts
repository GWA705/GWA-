import 'server-only';
import { getOffice } from './monthly';
import { readJournal } from './journalRead';
import { readLeads, leadKeyOf } from '@/lib/leads';
import { readLeadCalls } from '@/lib/leadCalls';
import { latestOutcome } from './leadsReport';
import { buildFundingReport, weekWindow, monthWindow } from './fundingReport';
import { loadVocReport } from './voc';

/**
 * The dealer "digest" — a one-glance snapshot of an office's week or month:
 * leads (and vs. the prior period), the financing mix (incl. HD Credit Cards),
 * funded $, and VOC. Assembled from the existing report sources so the numbers
 * tie out to the full reports. This is the on-screen Phase 1; the emailed +
 * scheduled versions build on the same `buildDealerDigest`.
 */

export type DigestPeriod = 'week' | 'month';

export interface DigestTrendPoint {
  label: string;
  total: number;
}

export interface DealerDigest {
  configured: boolean;
  office: string;
  period: DigestPeriod;
  periodLabel: string;
  leads: {
    total: number;
    prev: number;
    deltaPct: number | null; // null = "New" (no leads last period)
    contacted: number;
    bookedSold: number;
    noGood: number;
    byKind: { kind: string; count: number }[];
  };
  trend: DigestTrendPoint[]; // last 8 periods ending at the selected one
  financing: {
    okDeals: number; // confirmed deals in the period (sale date)
    financed: number; // loan-financed (FinanceIt/UEI/GHS/etc.)
    hdCreditCards: number; // HDCC
    financeIt: number; // HDFINIT
    cashOther: number; // cash/cheque/credit card/other
    fundedDeals: number; // deals PAID in the period
    fundedTotal: number; // $ paid in the period
  };
  voc: { completed: number; avgRating: number | null; topReps: { rep: string; count: number }[] };
  highlights: string[];
  generatedAt: string;
}

const LOAN_BUCKETS = new Set(['HDFINIT', 'HDUEI', 'GHSFINIT', 'GoodHome', 'Enercare', 'Project Loan']);

const fmtDay = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const winOf = (period: DigestPeriod, offset: number) => (period === 'week' ? weekWindow(offset) : monthWindow(offset));

export async function buildDealerDigest(
  dealerId: string,
  period: DigestPeriod,
  offset = 0,
): Promise<DealerDigest> {
  const office = await getOffice(dealerId);
  const storeSet = new Set((office?.storeNumbers ?? []).map((s) => s.trim()));
  const win = winOf(period, offset);
  const prevWin = winOf(period, offset - 1);
  const periodLabel =
    period === 'week'
      ? `${fmtDay(win.start)} – ${fmtDay(addDays(win.end, -1))}`
      : win.start.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // ---- Leads (office-scoped) ----
  const read = await readLeads();
  const leadsConfigured = read.configured && !read.error;
  const leadsOut: DealerDigest['leads'] = { total: 0, prev: 0, deltaPct: 0, contacted: 0, bookedSold: 0, noGood: 0, byKind: [] };
  let trend: DigestTrendPoint[] = [];
  if (leadsConfigured) {
    const officeLeads = read.leads.filter((l) => storeSet.has((l.storeNumber || '').trim()));
    const inWin = (d: Date | null) => !!d && d >= win.start && d < win.end;
    const inPrev = (d: Date | null) => !!d && d >= prevWin.start && d < prevWin.end;
    const cur = officeLeads.filter((l) => inWin(l.dateReceived));
    const prev = officeLeads.filter((l) => inPrev(l.dateReceived));
    const keys = [...new Set(cur.map(leadKeyOf))];
    const calls = await readLeadCalls(keys, { dealerId }); // office-scoped digest
    const kinds = new Map<string, number>();
    let contacted = 0;
    let bookedSold = 0;
    let noGood = 0;
    for (const l of cur) {
      if (l.noGood) noGood += 1;
      const kind = (l.service || '').trim() || 'Unspecified';
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      const o = latestOutcome(calls[leadKeyOf(l)] ?? []);
      if (o !== 'notCalled') contacted += 1;
      if (o === 'booked' || o === 'sold') bookedSold += 1;
    }
    const deltaPct = prev.length > 0 ? Math.round(((cur.length - prev.length) / prev.length) * 100) : cur.length > 0 ? null : 0;
    leadsOut.total = cur.length;
    leadsOut.prev = prev.length;
    leadsOut.deltaPct = deltaPct;
    leadsOut.contacted = contacted;
    leadsOut.bookedSold = bookedSold;
    leadsOut.noGood = noGood;
    leadsOut.byKind = [...kinds.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count).slice(0, 4);

    trend = [];
    for (let k = 7; k >= 0; k -= 1) {
      const w = winOf(period, offset - k);
      const label = period === 'week' ? fmtDay(w.start) : w.start.toLocaleString('en-US', { month: 'short' });
      const total = officeLeads.filter((l) => l.dateReceived && l.dateReceived >= w.start && l.dateReceived < w.end).length;
      trend.push({ label, total });
    }
  }

  // ---- Financing mix (journal deals, OK, by sale date, office stores) ----
  const financing: DealerDigest['financing'] = { okDeals: 0, financed: 0, hdCreditCards: 0, financeIt: 0, cashOther: 0, fundedDeals: 0, fundedTotal: 0 };
  for (let y = win.start.getFullYear(); y <= win.end.getFullYear(); y += 1) {
    const read2 = await readJournal(y);
    if (read2.error) continue;
    for (const d of read2.deals) {
      if (d.result === 'RB') continue;
      if (!d.storeNumber || !storeSet.has(d.storeNumber)) continue;
      if (!d.date || d.date < win.start || d.date >= win.end) continue;
      financing.okDeals += 1;
      if (d.financeBucket === 'HDCC') financing.hdCreditCards += 1;
      else if (LOAN_BUCKETS.has(d.financeBucket)) {
        financing.financed += 1;
        if (d.financeBucket === 'HDFINIT') financing.financeIt += 1;
      } else financing.cashOther += 1;
    }
  }
  // Paid $ in the period — reuse the funding report (OK deals by date paid).
  const funding = await buildFundingReport(win, { dealerId });
  financing.fundedDeals = funding.count;
  financing.fundedTotal = funding.total;

  // ---- VOC (office-scoped, period) ----
  const vocReport = await loadVocReport({ dealerId, from: iso(win.start), to: iso(addDays(win.end, -1)) });
  const vocOffice = vocReport.offices[0];
  const voc: DealerDigest['voc'] = {
    completed: vocReport.totalVocs,
    avgRating: vocOffice?.avgOverall ?? null,
    topReps: (vocOffice?.reps ?? []).filter((r) => r.matched).slice(0, 3).map((r) => ({ rep: r.rep, count: r.count })),
  };

  // ---- Highlights ----
  const highlights: string[] = [];
  if (leadsOut.deltaPct != null && leadsOut.prev > 0) {
    const dir = leadsOut.deltaPct >= 0 ? 'up' : 'down';
    highlights.push(`Leads ${dir} ${Math.abs(leadsOut.deltaPct)}% vs last ${period} (${leadsOut.total} vs ${leadsOut.prev}).`);
  } else if (leadsOut.total > 0) {
    highlights.push(`${leadsOut.total} leads this ${period}.`);
  }
  if (financing.fundedTotal > 0) highlights.push(`$${Math.round(financing.fundedTotal).toLocaleString('en-CA')} funded across ${financing.fundedDeals} paid deal${financing.fundedDeals === 1 ? '' : 's'}.`);
  if (financing.hdCreditCards > 0) highlights.push(`${financing.hdCreditCards} Home Depot Credit Card${financing.hdCreditCards === 1 ? '' : 's'} this ${period}.`);
  if (voc.completed > 0) highlights.push(`${voc.completed} VOC review${voc.completed === 1 ? '' : 's'} completed${voc.avgRating != null ? ` (avg ${voc.avgRating.toFixed(1)})` : ''}.`);

  return {
    configured: leadsConfigured || financing.okDeals > 0 || voc.completed > 0,
    office: office?.name ?? 'Your office',
    period,
    periodLabel,
    leads: leadsOut,
    trend,
    financing,
    voc,
    highlights,
    generatedAt: new Date().toISOString(),
  };
}

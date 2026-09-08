import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { getOffice, type Office } from './monthly';

/**
 * Finance penetration — for one office in a year, how deals were paid: financed
 * (Financeit / project loans) vs cash/cheque/e-transfer vs other. Penetration % =
 * financed deals ÷ total paid-OK deals. Money basis matches the monthly report
 * (OK result, counted by DATE PAID), so the numbers reconcile.
 */

export type FinanceGroup = 'financed' | 'cash' | 'other';

export interface FinanceBucketStat {
  bucket: string; // raw journal finance bucket (e.g. "HDFINIT")
  group: FinanceGroup;
  count: number;
  gross: number;
}

export interface FinanceStoreRow {
  store: string;
  label: string;
  total: number; // deal count
  financed: number; // financed deal count
  pct: number | null; // financed / total, null when total = 0
  gross: number;
}

export interface FinancePenetrationReport {
  office: Office | null;
  year: number;
  configured: boolean;
  error?: string;
  totalCount: number;
  totalGross: number;
  financedCount: number;
  financedGross: number;
  cashCount: number;
  penetrationPct: number | null;
  buckets: FinanceBucketStat[];
  byStore: FinanceStoreRow[];
}

function groupOf(bucket: string): FinanceGroup {
  const b = bucket.toUpperCase();
  if (b.includes('FINIT') || b.includes('PROJECT LOAN') || b.includes('LOAN')) return 'financed';
  if (b.includes('CASH') || b.includes('CHEQUE') || b.includes('ETRANSFER') || b.includes('E-TRANSFER')) return 'cash';
  return 'other';
}

export async function buildFinancePenetration(dealerId: string, year: number): Promise<FinancePenetrationReport> {
  const office = await getOffice(dealerId);
  const cur = await readJournal(year);

  const storeSet = new Set(office?.storeNumbers ?? []);
  const belongs = (d: ReportDeal) => (d.storeNumber ? storeSet.has(d.storeNumber) : false);
  const isPaidOk = (d: ReportDeal) => d.result === 'OK' && !!d.datePaid && (d.datePaid as Date).getFullYear() === year;

  const deals = cur.deals.filter((d) => belongs(d) && isPaidOk(d));

  const bucketMap = new Map<string, FinanceBucketStat>();
  const storeMap = new Map<string, FinanceStoreRow>();
  const labelFor = (num: string) => {
    const nm = office?.storeNames[num] || '';
    return nm ? `${num} — ${nm}` : num;
  };
  // Seed known stores so a store with 0 deals still shows.
  for (const s of office?.storeNumbers ?? []) storeMap.set(s, { store: s, label: labelFor(s), total: 0, financed: 0, pct: null, gross: 0 });

  let totalCount = 0;
  let totalGross = 0;
  let financedCount = 0;
  let financedGross = 0;
  let cashCount = 0;

  for (const d of deals) {
    const bucket = d.financeBucket && d.financeBucket !== 'Unknown' ? d.financeBucket : 'Unspecified';
    const group = groupOf(bucket);

    const bs = bucketMap.get(bucket) ?? { bucket, group, count: 0, gross: 0 };
    bs.count += 1;
    bs.gross += d.gross;
    bucketMap.set(bucket, bs);

    const store = d.storeNumber || d.hdStore || 'Unknown';
    const sr = storeMap.get(store) ?? { store, label: labelFor(store), total: 0, financed: 0, pct: null, gross: 0 };
    sr.total += 1;
    sr.gross += d.gross;
    if (group === 'financed') sr.financed += 1;
    storeMap.set(store, sr);

    totalCount += 1;
    totalGross += d.gross;
    if (group === 'financed') { financedCount += 1; financedGross += d.gross; }
    if (group === 'cash') cashCount += 1;
  }

  const buckets = Array.from(bucketMap.values()).sort((a, b) => b.gross - a.gross);
  const byStore = Array.from(storeMap.values())
    .map((r) => ({ ...r, pct: r.total > 0 ? Math.round((r.financed / r.total) * 100) : null }))
    .sort((a, b) => b.gross - a.gross);

  return {
    office,
    year,
    configured: cur.configured,
    error: cur.error,
    totalCount,
    totalGross,
    financedCount,
    financedGross,
    cashCount,
    penetrationPct: totalCount > 0 ? Math.round((financedCount / totalCount) * 100) : null,
    buckets,
    byStore,
  };
}

import 'server-only';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { readJournal, sheetIdFor } from '@/lib/reporting/journalRead';
import { buildDealerMatcher } from '@/lib/reporting/dealerMatch';

/** One archived past-journal deal, reduced to what the dealer search shows. */
export interface ArchiveMatch {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  product: string;
  hdStore: string;
  result: string;
  finance: string;
  amount: string; // formatted, or ''
  saleDate: string; // yyyy-mm-dd or ''
  year: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

/**
 * Search a dealer's OWN office's archived past-journal customers by name or
 * phone. Strictly scoped to the passed dealerId — a dealer never sees another
 * office's rows. Read-only. Returns [] when the office id is missing.
 */
export async function searchOfficeJournalArchive(dealerId: string | null | undefined, query: string): Promise<ArchiveMatch[]> {
  if (!dealerId) return [];
  const q = query.trim();
  if (q.length < 3) return [];

  const digits = q.replace(/\D/g, '');
  const isPhone = digits.length >= 7;

  const where: Prisma.JournalRecordWhereInput = { dealerId };
  if (isPhone) {
    where.phone = { contains: digits.slice(-10) };
  } else {
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
    where.AND = terms.map((t) => ({ customerName: { contains: t, mode: 'insensitive' as const } }));
  }

  const rows = await prisma.journalRecord.findMany({
    where,
    orderBy: [{ saleDate: 'desc' }, { year: 'desc' }],
    take: 25,
  });

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName || `${r.firstName} ${r.lastName}`.trim() || '(no name)',
    phone: r.phone,
    address: r.address,
    product: r.product,
    hdStore: r.hdStore,
    result: r.result,
    finance: r.financeBucket && r.financeBucket !== 'Unknown' ? r.financeBucket : '',
    amount: r.gross != null && Number(r.gross) > 0 ? money(Number(r.gross)) : '',
    saleDate: r.saleDate ? r.saleDate.toISOString().slice(0, 10) : '',
    year: r.year,
  }));
}

/**
 * Search a dealer's OWN office's CURRENT-year (and any future) sales journal —
 * read LIVE from Google Sheets, not the DB archive. This is the in-progress book:
 * the current year is deliberately never archived (it stays editable all year), so
 * without this a dealer couldn't find a live pending deal in Find customer even
 * though it shows in the weekly report. Rows are attributed to an office with the
 * SAME matcher the import/weekly report use (store number → alias → name token),
 * then filtered to the passed dealerId — a dealer never sees another office's rows.
 *
 * `excludeAppIds` drops any live row that is already shown as a portal deal in
 * "Your customers" (matched by the tab+row the portal recorded), so a deal that
 * exists both in the portal and the journal isn't listed twice.
 */
export async function searchOfficeLiveJournal(
  dealerId: string | null | undefined,
  query: string,
  excludeAppIds?: Set<string>,
): Promise<ArchiveMatch[]> {
  if (!dealerId) return [];
  const q = query.trim();
  if (q.length < 3) return [];

  // Live years = current year and any future year with a configured sheet. Closed
  // years are covered by the DB archive (searchOfficeJournalArchive above).
  const now = new Date().getFullYear();
  const years = [now + 1, now].filter((y) => sheetIdFor(y));
  if (years.length === 0) return [];

  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  const matchDeal = buildDealerMatcher(dealers);

  const reads = await Promise.all(years.map((y) => readJournal(y)));
  const deals = reads.flatMap((r) => r.deals);

  const qDigits = q.replace(/\D/g, '');
  const isPhone = qDigits.length >= 7;
  const last10 = qDigits.slice(-10);
  const terms = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t.length >= 2);

  type LiveRow = ArchiveMatch & { sort: number; tab: string; row: number };
  const out: LiveRow[] = [];
  for (const d of deals) {
    if (matchDeal(d) !== dealerId) continue;
    const name = `${d.firstName} ${d.lastName}`.trim();
    const phoneDigits = (d.phone || '').replace(/\D/g, '');
    const hdDigits = (d.hdRef || '').replace(/\D/g, '');
    let hit = false;
    if (isPhone) {
      hit = (phoneDigits !== '' && phoneDigits.includes(last10)) || (hdDigits !== '' && hdDigits.includes(qDigits));
    } else {
      const hay = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
      hit = terms.length > 0 && terms.every((t) => hay.includes(t));
    }
    if (!hit) continue;
    out.push({
      id: `live-${d.year}-${d.tab}-${d.rowNum}`,
      customerName: name || '(no name)',
      phone: d.phone || '',
      address: d.address || '',
      product: d.product || '',
      hdStore: d.hdStore || d.storeNumber || '',
      result: d.result || '',
      finance: d.financeBucket && d.financeBucket !== 'Unknown' ? d.financeBucket : '',
      amount: d.gross != null && Number(d.gross) > 0 ? money(Number(d.gross)) : '',
      saleDate: d.date ? d.date.toISOString().slice(0, 10) : '',
      year: d.year,
      sort: d.date?.getTime() ?? 0,
      tab: d.tab,
      row: d.rowNum,
    });
  }

  // Dedupe against portal deals already shown in "Your customers".
  let rows = out;
  if (excludeAppIds && excludeAppIds.size > 0) {
    const tabs = Array.from(new Set(out.map((m) => m.tab).filter(Boolean)));
    if (tabs.length > 0) {
      const apps = await prisma.application.findMany({
        where: { journalTab: { in: tabs }, journalRow: { not: null }, dealerId },
        select: { id: true, journalTab: true, journalRow: true },
      });
      const appByRow = new Map(apps.map((a) => [`${a.journalTab}|${a.journalRow}`, a.id]));
      rows = out.filter((m) => {
        const appId = appByRow.get(`${m.tab}|${m.row}`);
        return !(appId && excludeAppIds.has(appId));
      });
    }
  }

  return rows
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 25)
    .map(({ sort: _s, tab: _t, row: _r, ...m }) => m);
}

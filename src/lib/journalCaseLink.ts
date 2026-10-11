import 'server-only';

import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { encryptOptional } from '@/lib/crypto';
import { readJournal, EARLIEST_JOURNAL_YEAR, type ReportDeal } from '@/lib/reporting/journalRead';
import { buildDealerMatcher } from '@/lib/reporting/dealerMatch';
import {
  journalMatchKey,
  parseJournalMatchKey,
  queryNameTokens,
  phoneLast10,
  journalDealMatches,
  inferProgramCategory,
  paymentMethodFromBucket,
  splitProducts,
  journalDealNote,
  journalDealLabel,
} from '@/lib/journalDealMap';

/** How many calendar years back the journal search looks (current + 2 prior). */
const SEARCH_YEARS_BACK = 2;

function yearsToScan(): number[] {
  const now = new Date().getUTCFullYear();
  const out: number[] = [];
  for (let y = now; y >= now - SEARCH_YEARS_BACK && y >= EARLIEST_JOURNAL_YEAR; y -= 1) out.push(y);
  return out;
}

/** A journal match shown in the "In the sales journal" section of the link panel. */
export interface JournalMatchVM {
  key: string;
  name: string;
  detail: string; // one-line summary (program · #ref · product · date · amount)
  phone: string;
  address: string;
  year: number;
}

/**
 * Search the sales journal for a customer who may have been typed straight into
 * the sheet (so they have no portal deal). Matches by phone (last-10) or name,
 * across the current + two prior journals. Rows that already exist as a portal
 * deal (same HD Ref, or already materialized from this exact journal row) are
 * dropped so the reviewer isn't offered a duplicate.
 */
export async function searchJournalForCase(opts: {
  query?: string;
  caseName?: string | null;
  casePhone?: string | null;
}): Promise<JournalMatchVM[]> {
  const raw = (opts.query || '').trim();
  const tokens = queryNameTokens(raw || opts.caseName || '');
  const last10 = phoneLast10(raw || opts.casePhone || '');
  if (!tokens.length && !last10) return [];

  const hits: ReportDeal[] = [];
  for (const year of yearsToScan()) {
    let read;
    try {
      read = await readJournal(year);
    } catch {
      continue; // a single bad year shouldn't break the search
    }
    if (read.error || !read.configured) continue;
    for (const d of read.deals) {
      if (journalDealMatches(d, tokens, last10)) hits.push(d);
    }
  }
  if (hits.length === 0) return [];

  // Drop rows that are already represented as a portal deal: same HD Ref #, or a
  // deal we already created from this exact journal row.
  const refs = Array.from(new Set(hits.map((h) => h.hdRef).filter((r) => r && r.trim())));
  const tabs = Array.from(new Set(hits.map((h) => h.tab)));
  const existing = await prisma.application.findMany({
    where: {
      OR: [
        refs.length ? { hdReference: { in: refs } } : undefined,
        { journalSourced: true, journalTab: { in: tabs } },
      ].filter(Boolean) as object[],
    },
    select: { hdReference: true, journalTab: true, journalRow: true, journalSourced: true },
  });
  const takenRefs = new Set(existing.map((e) => (e.hdReference || '').trim()).filter(Boolean));
  const takenRows = new Set(
    existing.filter((e) => e.journalSourced).map((e) => `${e.journalTab}::${e.journalRow}`),
  );

  const seen = new Set<string>();
  const out: JournalMatchVM[] = [];
  for (const d of hits) {
    if (d.hdRef && d.hdRef.trim() && takenRefs.has(d.hdRef.trim())) continue;
    if (takenRows.has(`${d.tab}::${d.rowNum}`)) continue;
    const key = journalMatchKey(d);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name: `${d.firstName} ${d.lastName}`.trim() || 'Unnamed customer',
      detail: journalDealLabel(d),
      phone: d.phone || '',
      address: d.address || '',
      year: d.year,
    });
    if (out.length >= 12) break;
  }
  // Most recent first (sort by sale date via the underlying hit order isn't
  // guaranteed, so sort by year desc then keep insertion order within a year).
  out.sort((a, b) => b.year - a.year);
  return out;
}

/** Find one journal row by its key, re-reading the sheet (never trust the client). */
async function findJournalDeal(key: string): Promise<ReportDeal | null> {
  const parsed = parseJournalMatchKey(key);
  if (!parsed) return null;
  let read;
  try {
    read = await readJournal(parsed.year);
  } catch {
    return null;
  }
  if (read.error) return null;
  return read.deals.find((d) => d.tab === parsed.tab && d.rowNum === parsed.rowNum) ?? null;
}

/**
 * Resolve the owning office for a journal row: HD store number first, then the
 * location/office name, then the case's existing office, then the Georgian Water
 * & Air house office as a last resort. Returns null only if no dealer exists.
 */
async function resolveDealerId(deal: ReportDeal, caseOfficeDealerId: string | null): Promise<string | null> {
  const dealers = await prisma.dealer.findMany({
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  if (dealers.length === 0) return null;
  const match = buildDealerMatcher(dealers)({ storeNumber: deal.storeNumber, location: deal.location });
  if (match) return match;
  if (caseOfficeDealerId && dealers.some((d) => d.id === caseOfficeDealerId)) return caseOfficeDealerId;
  const house = dealers.find((d) => /georgian/i.test(d.name));
  return house?.id ?? dealers[0].id;
}

export interface JournalLinkResult {
  ok?: boolean;
  error?: string;
  applicationId?: string;
}

/**
 * Create a portal deal from a journal row and link the HD Resolution case to it.
 * The deal is flagged journalSourced (excluded from pipeline/reports) and is NOT
 * written back to the journal (the row already lives there — the single money
 * source). Populates as much of the customer file as the journal holds.
 */
export async function createDealFromJournalRow(opts: {
  caseId: string;
  key: string;
  userId: string;
}): Promise<JournalLinkResult> {
  const c = await prisma.resolutionCase.findUnique({
    where: { id: opts.caseId },
    select: { id: true, caseNumber: true, applicationId: true, officeDealerId: true, customerPhone: true, hdReference: true, customerName: true },
  });
  if (!c) return { error: 'Case not found.' };
  if (c.applicationId) return { error: 'This case is already linked to a deal.' };

  const deal = await findJournalDeal(opts.key);
  if (!deal) return { error: 'That journal entry is no longer available — try searching again.' };

  // Reuse a deal we already created from this exact row, if any (idempotent).
  const already = await prisma.application.findFirst({
    where: { journalSourced: true, journalTab: deal.tab, journalRow: deal.rowNum },
    select: { id: true, dealerId: true },
  });

  let applicationId: string;
  let dealerId: string;

  if (already) {
    applicationId = already.id;
    dealerId = already.dealerId;
  } else {
    const resolvedDealerId = await resolveDealerId(deal, c.officeDealerId);
    if (!resolvedDealerId) return { error: 'No office is set up to attach this deal to — add a dealer first.' };
    dealerId = resolvedDealerId;

    const gross = Number.isFinite(deal.gross) && deal.gross > 0 ? deal.gross : 0;
    const products = splitProducts(deal.product);
    const paymentMethod = paymentMethodFromBucket(deal.financeBucket);

    // Street address is the one sensitive field; everything else is plaintext.
    const app = await prisma.application.create({
      data: {
        dealerId,
        createdById: opts.userId,
        status: 'FUNDED', // a journal row is a completed, paid sale
        entryMethod: 'DIRECT',
        journalSourced: true,
        province: 'ON', // Georgian Water & Air operates in Ontario; refine later if needed
        programType: deal.isHD ? 'HD' : 'GWA',
        programCategory: inferProgramCategory(deal.product),
        requestedAmount: gross,
        approvedAmount: gross || undefined,
        paymentMethod: paymentMethod ?? undefined,
        applicantFirstName: deal.firstName || '',
        applicantLastName: deal.lastName || '',
        applicantEmail: '',
        applicantPhone: deal.phone || '',
        applicantAddressEnc: encryptOptional(deal.address || null),
        hdReference: deal.hdRef || null,
        dateOfSale: deal.date ?? undefined,
        datePaid: deal.datePaid ?? undefined,
        salespersonName: deal.salesperson || null,
        productsSold: products,
        financingNote: `From sales journal: financing ${deal.financeBucket || '—'}; gross ${deal.gross || 0}, net to GWA ${deal.netToGWA || 0}. Row: ${deal.linkUrl}`,
        notes: `Materialized from the ${deal.year} sales journal (${deal.tab}, row ${deal.rowNum}).`,
        journalTab: deal.tab,
        journalRow: deal.rowNum,
        journalResult: deal.result || null,
        journalPaidOn: deal.datePaid ?? undefined,
        journalCheckedAt: new Date(),
      },
      select: { id: true },
    });
    applicationId = app.id;
  }

  // Link the case + backfill the customer file from the journal row.
  await prisma.resolutionCase.update({
    where: { id: opts.caseId },
    data: {
      applicationId,
      officeDealerId: dealerId,
      customerName: c.customerName || `${deal.firstName} ${deal.lastName}`.trim() || c.customerName,
      customerPhone: c.customerPhone || deal.phone || '',
      hdReference: c.hdReference || deal.hdRef || null,
      customerAddress: deal.address || undefined,
    },
  });

  await prisma.resolutionCaseNote.create({
    data: { caseId: opts.caseId, authorId: opts.userId, body: journalDealNote(deal) },
  });
  await audit({
    actorId: opts.userId,
    action: 'STATUS_CHANGE',
    entityType: 'ResolutionCase',
    entityId: opts.caseId,
    detail: `Created journal-sourced deal ${applicationId} and linked case ${c.caseNumber} (journal ${deal.year} ${deal.tab} row ${deal.rowNum})`,
  });

  return { ok: true, applicationId };
}

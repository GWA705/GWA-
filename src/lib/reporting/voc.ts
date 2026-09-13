import 'server-only';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import {
  parseVocBuffer,
  buildVocBreakdown,
  extractRefs,
  normalizeRef,
  type VocBreakdown,
} from './vocMatch';
import { readJournal, EARLIEST_JOURNAL_YEAR } from './journalRead';
import { listReportOffices } from './monthly';

/**
 * Import a Home Depot VOC export (.xlsx buffer). Upserts by leadRef, so
 * re-uploading a fuller month is safe (no duplicates). Returns counts.
 */
export async function importVocBuffer(
  buf: Buffer | Uint8Array,
  userId: string | null,
): Promise<{ imported: number; total: number; created: number; updated: number; duplicatesInFile: number; error?: string }> {
  const zero = { imported: 0, total: 0, created: 0, updated: 0, duplicatesInFile: 0 };
  const { rows, error } = await parseVocBuffer(buf);
  if (error) return { ...zero, error };
  if (rows.length === 0) return { ...zero, error: 'No VOC rows found in the file.' };

  // De-dupe WITHIN the file by the normalized (digits-only) Lead #, so the same
  // number written twice — or written in two formats (800237993 vs 800-237-993) —
  // collapses to one row (last occurrence wins).
  const byKey = new Map<string, (typeof rows)[number]>();
  let duplicatesInFile = 0;
  for (const r of rows) {
    const key = normalizeRef(r.leadRef);
    if (key.length < 6) continue; // ignore junk / non-reference values
    if (byKey.has(key)) duplicatesInFile += 1;
    byKey.set(key, r);
  }

  const keys = [...byKey.keys()];
  // Which of these already exist → so we can report new vs. updated.
  const existing = new Set(
    (await prisma.vocEntry.findMany({ where: { leadRef: { in: keys } }, select: { leadRef: true } })).map((e) => e.leadRef),
  );

  let created = 0;
  let updated = 0;
  for (const [key, r] of byKey) {
    const data = {
      storeName: r.storeName,
      storeNumber: r.storeNumber,
      district: r.district,
      submissionDate: r.submissionDate ? new Date(r.submissionDate) : null,
      reviewText: r.reviewText,
      overallRating: r.overallRating,
      ivoc: r.ivoc,
      ltsa: r.ltsa,
      knowledgeable: r.knowledgeable,
      timely: r.timely,
      workmanship: r.workmanship,
      communication: r.communication,
      installerCare: r.installerCare,
      installerFriendliness: r.installerFriendliness,
    };
    // leadRef is stored normalized (digits only) and is UNIQUE, so re-imports can
    // never create a duplicate row — they update the existing one.
    await prisma.vocEntry.upsert({
      where: { leadRef: key },
      create: { leadRef: key, importedById: userId, ...data },
      update: { importedById: userId, importedAt: new Date(), ...data },
    });
    if (existing.has(key)) updated += 1;
    else created += 1;
  }
  return { imported: byKey.size, total: rows.length, created, updated, duplicatesInFile };
}

// --- shared journal read (deals for rep attribution) -----------------------

interface DealLite {
  hdRef: string;
  storeNumber: string | null;
  salesperson: string;
}

async function readAllDeals(): Promise<{ deals: DealLite[]; configured: boolean; journalError?: string }> {
  const currentYear = new Date().getUTCFullYear();
  const deals: DealLite[] = [];
  let configured = false;
  let journalError: string | undefined;
  for (let y = EARLIEST_JOURNAL_YEAR; y <= currentYear; y += 1) {
    const read = await readJournal(y);
    if (read.configured) configured = true;
    if (read.error) {
      journalError = read.error;
      continue;
    }
    for (const d of read.deals) deals.push({ hdRef: d.hdRef, storeNumber: d.storeNumber, salesperson: d.salesperson });
  }
  return { deals, configured, journalError };
}

// --- office & rep breakdown -------------------------------------------------

export interface VocReport extends VocBreakdown {
  configured: boolean; // journals reachable (so rep matching is possible)
  count: number; // VOC rows in the selected window
  totalStored: number; // VOC rows stored overall (ignores date filter)
  lastImportedAt: Date | null;
  journalError?: string;
  from?: string;
  to?: string;
}

/**
 * Build the VOC breakdown by office and rep. Pass a dealerId to scope to one
 * office (the dealer view); omit for all offices. Optional from/to ('YYYY-MM-DD')
 * filter by VOC submission date. Reads every journal year so a 2026 VOC on a
 * 2025 deal still matches.
 */
export async function loadVocReport(
  opts: { dealerId?: string; from?: string; to?: string } = {},
): Promise<VocReport> {
  const dateWhere: { gte?: Date; lte?: Date } = {};
  if (opts.from) dateWhere.gte = new Date(`${opts.from}T00:00:00`);
  if (opts.to) dateWhere.lte = new Date(`${opts.to}T23:59:59`);
  const hasDate = dateWhere.gte != null || dateWhere.lte != null;

  const [entries, totalStored, offices, journal] = await Promise.all([
    prisma.vocEntry.findMany({
      where: hasDate ? { submissionDate: dateWhere } : {},
      select: { leadRef: true, storeNumber: true, overallRating: true, importedAt: true },
    }),
    prisma.vocEntry.count(),
    listReportOffices(),
    readAllDeals(),
  ]);

  const breakdown = buildVocBreakdown(
    {
      vocs: entries.map((e) => ({ leadRef: e.leadRef, storeNumber: e.storeNumber, overallRating: e.overallRating ?? null })),
      deals: journal.deals,
      offices: offices.map((o) => ({ dealerId: o.dealerId, name: o.name, storeNumbers: o.storeNumbers })),
    },
    opts.dealerId ? { restrictDealerIds: [opts.dealerId] } : {},
  );

  const lastImportedAt = entries.reduce<Date | null>((max, e) => (!max || e.importedAt > max ? e.importedAt : max), null);

  return {
    ...breakdown,
    configured: journal.configured,
    count: entries.length,
    totalStored,
    lastImportedAt,
    journalError: journal.journalError,
    from: opts.from,
    to: opts.to,
  };
}

// --- lookup: has a VOC been completed for these numbers? --------------------

export interface VocLookupRow {
  ref: string; // as entered
  completed: boolean; // a VOC exists for this Lead #
  submissionDate: string | null; // ISO date of the VOC
  overallRating: number | null;
  storeName: string | null;
  office: string | null; // resolved from store number (or matched deal)
  rep: string | null; // from the journal match
}

export interface VocLookupResult {
  rows: VocLookupRow[];
  total: number;
  completedCount: number;
  outstandingCount: number;
}

/** Flatten an uploaded file to text so extractRefs can pull numbers out of it. */
export async function extractRefsFromFile(buf: Buffer | Uint8Array, filename: string): Promise<string[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx')) {
    try {
      const zip = await JSZip.loadAsync(buf);
      let text = '';
      const ss = (await zip.file('xl/sharedStrings.xml')?.async('string')) || '';
      for (const t of ss.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += ' ' + t[1];
      for (const path of Object.keys(zip.files)) {
        if (/xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
          const xml = await zip.file(path)!.async('string');
          for (const v of xml.matchAll(/<v>([\s\S]*?)<\/v>/g)) text += ' ' + v[1];
        }
      }
      return extractRefs(text);
    } catch {
      return [];
    }
  }
  // csv / txt / anything else: treat as UTF-8 text
  return extractRefs(Buffer.from(buf).toString('utf8'));
}

/**
 * For each reference number, report whether a VOC has been completed, plus the
 * office and rep (from the journal) so the row is identifiable. Order preserved.
 */
export async function lookupVocs(refs: string[]): Promise<VocLookupResult> {
  const wanted = refs.map((r) => ({ raw: r.trim(), key: normalizeRef(r) })).filter((r) => r.key.length >= 6);

  const [entries, offices, journal] = await Promise.all([
    prisma.vocEntry.findMany({
      select: { leadRef: true, storeName: true, storeNumber: true, submissionDate: true, overallRating: true },
    }),
    listReportOffices(),
    readAllDeals(),
  ]);

  const vocByRef = new Map<string, (typeof entries)[number]>();
  for (const e of entries) vocByRef.set(normalizeRef(e.leadRef), e);

  const dealByRef = new Map<string, DealLite>();
  for (const d of journal.deals) {
    const k = normalizeRef(d.hdRef);
    if (k.length < 6) continue;
    const ex = dealByRef.get(k);
    if (!ex || (!ex.salesperson.trim() && d.salesperson.trim())) dealByRef.set(k, d);
  }
  const storeToOffice = new Map<string, string>();
  for (const o of offices) for (const s of o.storeNumbers) storeToOffice.set(String(s).trim(), o.name);

  const rows: VocLookupRow[] = [];
  const seen = new Set<string>();
  for (const { raw, key } of wanted) {
    if (seen.has(key)) continue;
    seen.add(key);
    const voc = vocByRef.get(key);
    const deal = dealByRef.get(key);
    const storeNumber = voc?.storeNumber ?? deal?.storeNumber ?? null;
    rows.push({
      ref: raw,
      completed: !!voc,
      submissionDate: voc?.submissionDate ? voc.submissionDate.toISOString().slice(0, 10) : null,
      overallRating: voc?.overallRating ?? null,
      storeName: voc?.storeName ?? null,
      office: (storeNumber && storeToOffice.get(storeNumber)) || null,
      rep: deal?.salesperson?.trim() || null,
    });
  }

  const completedCount = rows.filter((r) => r.completed).length;
  return { rows, total: rows.length, completedCount, outstandingCount: rows.length - completedCount };
}

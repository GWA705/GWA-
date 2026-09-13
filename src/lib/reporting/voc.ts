import 'server-only';
import { prisma } from '@/lib/db';
import { parseVocBuffer, buildVocBreakdown, type VocBreakdown } from './vocMatch';
import { readJournal, EARLIEST_JOURNAL_YEAR } from './journalRead';
import { listReportOffices } from './monthly';

/**
 * Import a Home Depot VOC export (.xlsx buffer). Upserts by leadRef, so
 * re-uploading a fuller month is safe (no duplicates). Returns counts.
 */
export async function importVocBuffer(
  buf: Buffer | Uint8Array,
  userId: string | null,
): Promise<{ imported: number; total: number; error?: string }> {
  const { rows, error } = await parseVocBuffer(buf);
  if (error) return { imported: 0, total: 0, error };
  if (rows.length === 0) return { imported: 0, total: 0, error: 'No VOC rows found in the file.' };

  let imported = 0;
  for (const r of rows) {
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
    await prisma.vocEntry.upsert({
      where: { leadRef: r.leadRef },
      create: { leadRef: r.leadRef, importedById: userId, ...data },
      update: { importedById: userId, importedAt: new Date(), ...data },
    });
    imported += 1;
  }
  return { imported, total: rows.length };
}

export interface VocReport extends VocBreakdown {
  configured: boolean; // journals reachable (so rep matching is possible)
  count: number; // VOC rows stored
  lastImportedAt: Date | null;
  journalError?: string;
}

/**
 * Build the VOC breakdown by office and rep. Pass a dealerId to scope to one
 * office (the dealer view); omit for all offices (staff/admin). Reads every
 * journal year (2024→current) so a 2026 VOC on a 2025 deal still matches.
 */
export async function loadVocReport(opts: { dealerId?: string } = {}): Promise<VocReport> {
  const [entries, offices] = await Promise.all([
    prisma.vocEntry.findMany({
      select: { leadRef: true, storeNumber: true, overallRating: true, importedAt: true },
    }),
    listReportOffices(),
  ]);

  const currentYear = new Date().getUTCFullYear();
  const deals: { hdRef: string; storeNumber: string | null; salesperson: string }[] = [];
  let journalError: string | undefined;
  let configured = false;
  for (let y = EARLIEST_JOURNAL_YEAR; y <= currentYear; y += 1) {
    const read = await readJournal(y);
    if (read.configured) configured = true;
    if (read.error) {
      journalError = read.error;
      continue;
    }
    for (const d of read.deals) {
      deals.push({ hdRef: d.hdRef, storeNumber: d.storeNumber, salesperson: d.salesperson });
    }
  }

  const breakdown = buildVocBreakdown(
    {
      vocs: entries.map((e) => ({
        leadRef: e.leadRef,
        storeNumber: e.storeNumber,
        overallRating: e.overallRating ?? null,
      })),
      deals,
      offices: offices.map((o) => ({ dealerId: o.dealerId, name: o.name, storeNumbers: o.storeNumbers })),
    },
    opts.dealerId ? { restrictDealerIds: [opts.dealerId] } : {},
  );

  const lastImportedAt = entries.reduce<Date | null>(
    (max, e) => (!max || e.importedAt > max ? e.importedAt : max),
    null,
  );

  return {
    ...breakdown,
    configured,
    count: entries.length,
    lastImportedAt,
    journalError,
  };
}

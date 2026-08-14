import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from './db';
import { readDealJournalStatus } from './journal';
import { notifyStatusChange } from './notify';
import { audit } from './audit';

/**
 * Journal → portal paid sync (the reverse of "Write to Journal").
 *
 * Reads a deal's journal row and reflects its settlement: when the journal shows
 * Result = "OK" and a Date Paid, the deal is paid — we record journalPaidOn and
 * auto-advance the deal to FUNDED if it isn't already. This handles the case
 * where a deal is settled in the journal before anyone clicks "Funded" in the
 * portal: both steps fill in on their own.
 *
 * Safety: the read validates the row's Last Name still matches the deal. If it
 * doesn't (a shifted/re-used row), we record the check time but change nothing —
 * we never move money-adjacent state on a shaky match.
 */

export interface JournalSyncOutcome {
  applicationId: string;
  ok: boolean;
  paid: boolean; // journal shows OK + Date Paid
  funded: boolean; // we advanced it to FUNDED this run
  skipped?: string;
  error?: string;
}

const TERMINAL: ApplicationStatus[] = ['DECLINED', 'WITHDRAWN', 'DRAFT'];

export async function syncApplicationFromJournal(applicationId: string, actorId: string | null = null): Promise<JournalSyncOutcome> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true, status: true, applicantLastName: true, dateOfSale: true, createdAt: true,
      journalTab: true, journalRow: true, journalPaidOn: true,
    },
  });
  if (!app) return { applicationId, ok: false, paid: false, funded: false, skipped: 'not found' };
  if (!app.journalTab || !app.journalRow) {
    return { applicationId, ok: false, paid: false, funded: false, skipped: 'not written to journal' };
  }

  const saleYear = (app.dateOfSale ?? app.createdAt).getFullYear();
  const read = await readDealJournalStatus({
    knownTab: app.journalTab,
    knownRow: app.journalRow,
    lastName: app.applicantLastName,
    saleYear,
  });

  if (!read.found) {
    await prisma.application.update({ where: { id: app.id }, data: { journalCheckedAt: new Date() } });
    return { applicationId, ok: false, paid: false, funded: false, error: read.error ?? 'row not found' };
  }
  if (!read.lastNameMatches) {
    await prisma.application.update({ where: { id: app.id }, data: { journalCheckedAt: new Date() } });
    return { applicationId, ok: false, paid: false, funded: false, skipped: 'journal row no longer matches (name mismatch)' };
  }

  const paid = read.isOk && !!read.datePaid;

  await prisma.application.update({
    where: { id: app.id },
    data: {
      journalResult: read.result,
      journalPaidOn: paid ? read.datePaid : null,
      journalCheckedAt: new Date(),
    },
  });

  // Paid in the journal ⟹ Funded in the portal. Advance it if we can.
  let funded = false;
  if (paid && app.status !== 'FUNDED' && !TERMINAL.includes(app.status)) {
    const paidLabel = read.datePaid!.toLocaleDateString('en-CA');
    await prisma.application.update({ where: { id: app.id }, data: { status: 'FUNDED' } });
    // A status-history line needs an actor (on-demand run). The scheduled sweep
    // has no user, so it records the transition in the audit trail instead.
    if (actorId) {
      await prisma.statusEvent.create({
        data: { applicationId: app.id, from: app.status, to: 'FUNDED', actorId, note: `Journal shows OK, paid ${paidLabel}` },
      });
    }
    await audit({ actorId, action: 'STATUS_CHANGE', entityType: 'Application', entityId: app.id, detail: `Auto-funded from journal (paid ${paidLabel})` });
    await notifyStatusChange(app.id, 'FUNDED');
    funded = true;
  }

  return { applicationId, ok: true, paid, funded };
}

/**
 * Sweep every live, journal-written deal that isn't yet recorded as paid, and
 * sync it. Runs from the cron endpoint (and can be triggered per-deal on demand).
 */
export async function sweepJournalPaid(): Promise<{ checked: number; funded: number; paid: number; errors: number }> {
  const candidates = await prisma.application.findMany({
    where: {
      journalTab: { not: null },
      journalRow: { not: null },
      journalPaidOn: null,
      status: { notIn: TERMINAL },
    },
    select: { id: true },
    take: 500,
  });

  let funded = 0, paid = 0, errors = 0;
  for (const c of candidates) {
    try {
      const out = await syncApplicationFromJournal(c.id);
      if (out.paid) paid += 1;
      if (out.funded) funded += 1;
      if (out.error) errors += 1;
    } catch {
      errors += 1;
    }
  }
  return { checked: candidates.length, funded, paid, errors };
}

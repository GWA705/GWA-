import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from './db';
import { readDealJournalStatus, findDealRowByIdentity } from './journal';
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
  // When we read the row but it isn't "paid", this says exactly what was
  // missing (Result not "OK", no Date Paid, …) so the reviewer knows what to
  // fix in the journal instead of guessing.
  reason?: string;
}

const TERMINAL: ApplicationStatus[] = ['DECLINED', 'WITHDRAWN', 'DRAFT'];

// A fallback actor for the scheduled sweep (no logged-in user): the first active
// admin. A Payout needs a non-null createdById.
let _cachedSystemActor: string | null = null;
async function systemActorId(): Promise<string> {
  if (_cachedSystemActor) return _cachedSystemActor;
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  _cachedSystemActor = admin?.id ?? '';
  return _cachedSystemActor;
}

export async function syncApplicationFromJournal(applicationId: string, actorId: string | null = null): Promise<JournalSyncOutcome> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true, status: true, applicantLastName: true, applicantFirstName: true,
      hdReference: true, financeItNumber: true, dateOfSale: true, createdAt: true,
      journalTab: true, journalRow: true, journalPaidOn: true,
    },
  });
  if (!app) return { applicationId, ok: false, paid: false, funded: false, skipped: 'not found' };

  const saleYear = (app.dateOfSale ?? app.createdAt).getFullYear();

  // Resolve the deal's journal row. Deals the portal wrote carry a stored tab +
  // row; deals typed straight into the journal by hand don't — so we locate them
  // by identity (HD # / loan # / name) and remember the row for next time.
  // Re-find a deal in the live journal by identity (HD # / loan # / name).
  const reFind = () =>
    findDealRowByIdentity({
      saleYear,
      when: app.dateOfSale ?? app.createdAt,
      lastName: app.applicantLastName,
      firstName: app.applicantFirstName,
      hdReference: app.hdReference,
      loanNo: app.financeItNumber,
    });

  let tab = app.journalTab;
  let row = app.journalRow;
  const usedStoredPointer = !!(tab && row);
  if (!tab || !row) {
    const found = await reFind();
    if (found.error) {
      await prisma.application.update({ where: { id: app.id }, data: { journalCheckedAt: new Date() } });
      return { applicationId, ok: false, paid: false, funded: false, error: found.error };
    }
    if (!found.match) {
      await prisma.application.update({ where: { id: app.id }, data: { journalCheckedAt: new Date() } });
      return {
        applicationId, ok: false, paid: false, funded: false,
        reason: 'Couldn’t find this deal in the live journal yet — looked on the sale-month tab by HD Customer # and name. Make sure the journal row has the matching HD # (or the customer’s name) filled in.',
      };
    }
    tab = found.match.tab;
    row = found.match.row;
    // Remember where it is so future checks are a single, direct read.
    await prisma.application.update({ where: { id: app.id }, data: { journalTab: tab, journalRow: row } });
  }

  let read = await readDealJournalStatus(
    { knownTab: tab, knownRow: row, lastName: app.applicantLastName, saleYear },
    { liveOnly: true },
  );

  // Self-heal a STALE stored pointer: a saved tab/row can go bad when the office
  // renames or recreates the month tab (e.g. "Sep.2026" no longer exists, so the
  // read fails with "Unable to parse range"). Drop the dead pointer and re-find
  // the deal by identity against the journal's CURRENT tab names, then read again.
  if (!read.found && usedStoredPointer) {
    const found = await reFind();
    if (found.match) {
      tab = found.match.tab;
      row = found.match.row;
      await prisma.application.update({ where: { id: app.id }, data: { journalTab: tab, journalRow: row } });
      read = await readDealJournalStatus(
        { knownTab: tab, knownRow: row, lastName: app.applicantLastName, saleYear },
        { liveOnly: true },
      );
    } else {
      // Couldn't re-locate it — clear the dead pointer so the next run matches fresh.
      await prisma.application.update({ where: { id: app.id }, data: { journalTab: null, journalRow: null } });
    }
  }

  if (!read.found) {
    await prisma.application.update({ where: { id: app.id }, data: { journalCheckedAt: new Date() } });
    return { applicationId, ok: false, paid: false, funded: false, error: read.error ?? 'row not found' };
  }
  if (!read.lastNameMatches) {
    await prisma.application.update({ where: { id: app.id }, data: { journalCheckedAt: new Date() } });
    return { applicationId, ok: false, paid: false, funded: false, skipped: 'journal row no longer matches (name mismatch)' };
  }

  const paid = read.isOk && !!read.datePaid;

  // Spell out what's missing when the row isn't "paid", so the reviewer knows
  // exactly which journal cell to fix (a Date Paid alone isn't enough — the
  // Result column also has to read "OK").
  let reason: string | undefined;
  if (!paid) {
    const resultShown = read.result ? `“${read.result}”` : 'blank';
    if (!read.isOk && !read.datePaid) {
      reason = `Found the row, but the Result column reads ${resultShown} (it needs “OK”) and there’s no Date Paid yet.`;
    } else if (!read.isOk) {
      reason = `Found the row with a Date Paid, but the Result column reads ${resultShown} — it needs to read “OK” (not blank or “PE/OK”) before this counts as paid.`;
    } else {
      reason = 'Found the row and the Result is “OK”, but the Date Paid column is empty — add the paid date.';
    }
  }

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

  // Auto-fill the dealer payment receipt from the journal's "Pay to dealer"
  // column — the ACTUAL amount paid (net of admin fee / tax / reserve), which can
  // differ from the HD calculator estimate. Only when the journal shows paid, an
  // actual amount is present, and no payout has been recorded yet (so we never
  // duplicate or overwrite a manually entered receipt).
  if (paid && read.payToDealer != null && read.payToDealer > 0) {
    const existingPayouts = await prisma.payout.count({ where: { applicationId: app.id } });
    if (existingPayouts === 0) {
      const createdById = actorId ?? (await systemActorId());
      if (createdById) {
        await prisma.payout.create({
          data: {
            applicationId: app.id,
            amount: read.payToDealer,
            paidOn: read.datePaid!,
            method: 'EFT',
            note: 'Auto-filled from the sales journal (Pay to dealer)',
            createdById,
          },
        });
        await audit({ actorId, action: 'FUNDING_DECISION', entityType: 'Application', entityId: app.id, detail: `Payout auto-filled from journal: $${read.payToDealer.toFixed(2)}` });
      }
    }
  }

  return { applicationId, ok: true, paid, funded, reason };
}

/**
 * Sweep every live, journal-written deal that isn't yet recorded as paid, and
 * sync it. Runs from the cron endpoint (and can be triggered per-deal on demand).
 */
// Stages where a deal could be in the journal and settling — the sweep only
// looks at these, so it never scans brand-new (pre-journal) deals.
const SETTLING: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];

export async function sweepJournalPaid(): Promise<{ checked: number; funded: number; paid: number; errors: number }> {
  // Includes deals with NO stored journal pointer — those were typed into the
  // journal by hand and are matched by identity (see syncApplicationFromJournal).
  // Capped per run to keep Google Sheets reads within quota; once a deal's row is
  // found it's remembered, so later runs are cheap, and the 2-hourly cadence
  // works through a backlog.
  const candidates = await prisma.application.findMany({
    where: {
      journalPaidOn: null,
      status: { in: SETTLING },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
    take: 200,
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

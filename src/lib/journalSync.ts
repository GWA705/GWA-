import 'server-only';
import { prisma } from './db';
import { audit } from './audit';
import { journalEnabled, writeDealToJournal, type JournalDeal } from './journal';
import { journalProductNames } from './products';
import { dealHasFinancing, financedAmountOf, nonFinancedAmountOf, journalPayCode } from './payments';
import { soapLabel } from './constants';
import { decryptOptional } from './crypto';

/**
 * Write (or update) a deal's row in the Google Sheets sales journal from its
 * current Application record. Shared by the reviewer flows in (staff)/actions.ts
 * (on approval, on reference edits, and the manual "Write to Journal" button)
 * and by the Direct sale flow — a direct sale is created already paid, so it is
 * written as settled ("OK" Result + its Date Paid) rather than pending.
 *
 * Returns a status so the caller can surface a conflict/disabled/error without
 * failing the whole operation (the journal write is best-effort).
 */
export async function syncApplicationToJournal(
  applicationId: string,
  actorId: string,
): Promise<{ status: 'ok' | 'disabled' | 'error' | 'conflict'; message?: string }> {
  if (!journalEnabled()) return { status: 'disabled' };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { homeDepotStore: true, dealer: true, loanApplication: true, financeCompany: true, paymentSplits: true },
  });
  if (!app) return { status: 'error', message: 'Deal not found.' };

  const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
  const fmtAmount = (a: unknown) => (a == null ? null : Number(a).toFixed(2));
  const storeLabel = app.homeDepotStore
    ? app.homeDepotStore.name
      ? `${app.homeDepotStore.name} - ${app.homeDepotStore.number}`
      : app.homeDepotStore.number
    : null;

  // Journal writes the abbreviated product code (falls back to the full name).
  const journalProducts = await journalProductNames(app.productsSold, app.dealerId);

  // "How They Payed" code (col F) + the non-financed portion (col J, Cash/Chq/CC).
  const payCode = journalPayCode({
    programType: app.programType,
    paymentMethod: app.paymentMethod,
    financeCompanyName: app.financeCompany?.name ?? null,
    splitMethods: app.paymentSplits?.map((s) => s.method),
    hasFinancedPortion: dealHasFinancing(app),
  });
  const cashAmount = nonFinancedAmountOf(app);

  const deal: JournalDeal = {
    lastName: app.applicantLastName,
    firstName: app.applicantFirstName,
    hdReference: app.hdReference,
    financeItNumber: app.financeItNumber,
    hdStoreLabel: storeLabel,
    // Journal "Location" column: the dealer's journal short form when set, else
    // the full dealer name (mirrors products' journalName override).
    dealerName: app.dealer?.journalName?.trim() || app.dealer?.name || null,
    salesperson: app.salespersonName,
    installer: app.installerName,
    products: journalProducts.length ? journalProducts.join(', ') : null,
    // Number of units sold = number of products on the deal (e.g. a water
    // softener + city water deal writes "2").
    units: journalProducts.length ? String(journalProducts.length) : null,
    // Seed the Deal Result as pending ("PE/OK"); the office changes it to "OK"
    // once the deal pays. Note: the paid-sync's OK check excludes "pe", so this
    // correctly reads as not-yet-paid. A deal that is ALREADY paid when written
    // (a Direct sale — entered + funded in one go) is written as settled: "OK"
    // Result + its Date Paid, so the row matches the paid read-back immediately.
    result: app.datePaid ? 'OK' : 'PE/OK',
    soap: soapLabel(app.soapType, app.soapIncluded),
    payCode,
    financedAmount: fmtAmount(financedAmountOf(app)),
    cashAmount: cashAmount > 0 ? cashAmount.toFixed(2) : null,
    term: null,
    address: decryptOptional(app.applicantAddressEnc),
    city: app.applicantCity ?? app.loanApplication?.city ?? null,
    province: app.province,
    postalCode: app.applicantPostal ?? app.loanApplication?.postalCode ?? null,
    phone: app.applicantPhone,
    dealDate: fmtDate(app.dateOfSale),
    dateInstalled: fmtDate(app.installationDate),
    dateOfSale: fmtDate(app.dateOfSale),
    // Only written when the deal is already paid (Direct sale); null otherwise
    // leaves the office's Date Paid cell untouched.
    datePaid: fmtDate(app.datePaid),
    saleDate: app.dateOfSale ?? app.createdAt,
    knownTab: app.journalTab,
    knownRow: app.journalRow,
  };

  try {
    const result = await writeDealToJournal(deal);

    // Duplicate guard tripped: the deal is already on the journal but doesn't
    // line up. Don't record a row (we didn't write one) — surface it so a human
    // reconciles, rather than duplicating or overwriting.
    if (result.outcome === 'conflict') {
      await audit({
        actorId,
        action: 'JOURNAL_WRITE',
        entityType: 'Application',
        entityId: applicationId,
        detail: `Journal conflict — ${result.tab} row ${result.row}: ${result.message ?? 'reference already present'}`,
      });
      return { status: 'conflict', message: result.message };
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { journalTab: result.tab, journalRow: result.row, journalSyncedAt: new Date() },
    });
    await audit({
      actorId,
      action: 'JOURNAL_WRITE',
      entityType: 'Application',
      entityId: applicationId,
      detail: `Wrote to sales journal — ${result.tab} row ${result.row} (${result.outcome}, ${result.wrote.length} field${result.wrote.length === 1 ? '' : 's'}${result.skipped?.length ? `, kept ${result.skipped.length} existing` : ''})`,
    });

    const message =
      result.outcome === 'matched'
        ? `This deal was already on ${result.tab} (row ${result.row}) — filled ${result.wrote.length} blank field${result.wrote.length === 1 ? '' : 's'}${result.skipped?.length ? ` and left ${result.skipped.length} as entered (no overwrite)` : ''}.`
        : result.outcome === 'updated'
          ? `Updated ${result.tab}, row ${result.row}.`
          : `Added to ${result.tab}, row ${result.row}.`;
    return { status: 'ok', message };
  } catch (err) {
    console.error('[journal] write failed', err);
    return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

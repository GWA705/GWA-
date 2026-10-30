import 'server-only';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/db';
import { writeChargebackNoteToJournal, journalEnabled } from '@/lib/journal';

/**
 * Chargeback requests. When a reviewer approves a cancellation on a FUNDED deal,
 * GWA asks Home Depot's Central Settlement to take back the money it paid (a
 * "chargeback"). This builds the request email (which the reviewer reviews/edits
 * before sending) and sends it from the funding mailbox. For a FinanceIt deal,
 * FinanceIt Central Settlement Canada is CC'd so they cancel the financing too.
 *
 * Addresses are overridable by env, defaulting to the ones the office uses.
 */
export const CHARGEBACK_FROM = (process.env.CHARGEBACK_FROM_EMAIL || 'hdfunding@ghsbarrie.ca').trim();
export const CHARGEBACK_TO = (process.env.CHARGEBACK_CENTRAL_SETTLEMENT || 'centralsettlement_canada@homedepot.com').trim();
export const CHARGEBACK_FINANCEIT_CC = (process.env.CHARGEBACK_FINANCEIT_EMAIL || 'mtomashevsky@financeit.io').trim();

export interface ChargebackDealInfo {
  customerName: string;
  hdReference: string | null;
  dateOfSale: string | null; // pre-formatted (e.g. "06 Jan 2026")
  amount: string; // pre-formatted (e.g. "$6,725.97")
  financed: boolean; // a FinanceIt deal → CC FinanceIt Central Settlement Canada
}

/** The pre-filled chargeback request the reviewer reviews/edits before sending. */
export function buildChargebackDraft(d: ChargebackDealInfo): { subject: string; body: string } {
  const subject = `Cancellation / Chargeback request — ${d.customerName}${d.hdReference ? ` — HD Ref ${d.hdReference}` : ''}`;
  const lines = [
    'Hello Central Settlement,',
    '',
    'Please process a cancellation / chargeback for the following Home Depot deal:',
    '',
    `• Customer: ${d.customerName}`,
    `• HD reference: ${d.hdReference ?? ''}`,
    `• Date of sale: ${d.dateOfSale ?? ''}`,
    `• Amount: ${d.amount}`,
  ];
  if (d.financed) {
    lines.push(
      '',
      'FinanceIt deal — FinanceIt Central Settlement Canada, please also initiate cancellation of the financing for this reference.',
    );
  }
  lines.push('', 'Thank you,', 'Georgian Water & Air');
  return { subject, body: lines.join('\n') };
}

function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;line-height:1.6">${esc(text).replace(/\n/g, '<br>')}</div>`;
}

/**
 * Send the chargeback request email. From the funding mailbox, to Central
 * Settlement, CC FinanceIt when the deal is financed. Best-effort — returns
 * whether it actually sent (false in log-only mode or on an SMTP error).
 */
export async function sendChargebackEmail(args: { subject: string; body: string; financed: boolean }): Promise<{ sent: boolean; reason?: string }> {
  const res = await sendEmail({
    from: CHARGEBACK_FROM,
    replyTo: CHARGEBACK_FROM,
    to: CHARGEBACK_TO,
    cc: args.financed ? CHARGEBACK_FINANCEIT_CC : undefined,
    subject: args.subject.trim().slice(0, 250) || 'Cancellation / Chargeback request',
    html: textToHtml(args.body),
    text: args.body,
  });
  return { sent: res.sent, reason: res.reason };
}

/** Who the chargeback request goes to (for display in the reviewer UI). */
export function chargebackRecipients(financed: boolean): { from: string; to: string; cc: string | null } {
  return { from: CHARGEBACK_FROM, to: CHARGEBACK_TO, cc: financed ? CHARGEBACK_FINANCEIT_CC : null };
}

/**
 * Complete a pending chargeback when its line comes back on a remittance: link the
 * line, stamp completion, and add a dated "Chargeback completed" comment on the HD
 * Ref # cell (column E). No-op (returns false) when the deal has no pending
 * chargeback. Called from the remittance ingest when a chargeback line matches a
 * deal. Best-effort on the journal write — never throws.
 */
export async function completeChargebackFromRemittance(applicationId: string, remittanceLineId: string): Promise<boolean> {
  const cb = await prisma.dealCancellation.findFirst({
    where: { applicationId, chargebackRequestedAt: { not: null }, chargebackCompletedAt: null },
    orderBy: { chargebackRequestedAt: 'desc' },
    include: { application: { select: { journalTab: true, journalRow: true, applicantLastName: true, dateOfSale: true, createdAt: true } } },
  });
  if (!cb) return false;
  const now = new Date();
  await prisma.dealCancellation.update({
    where: { id: cb.id },
    data: { chargebackCompletedAt: now, chargebackLineId: remittanceLineId },
  });
  const app = cb.application;
  if (journalEnabled() && app.journalTab && app.journalRow) {
    const saleYear = (app.dateOfSale ?? app.createdAt).getFullYear();
    await writeChargebackNoteToJournal(
      { knownTab: app.journalTab, knownRow: app.journalRow, lastName: app.applicantLastName, saleYear },
      `Chargeback completed ${now.toLocaleDateString('en-CA')} — Home Depot took the amount back on a remittance.`,
    ).catch(() => {});
  }
  return true;
}

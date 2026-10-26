'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ingestRemittance, parseHdRemittanceText, reMatchUnmatchedLines, type RemittanceLineInput } from '@/lib/hdRemittance';
import { sendRemittanceReport, remittanceReportRecipients } from '@/lib/remittanceReport';
import { reprocessRemittanceByDoc } from '@/lib/hdRemittanceSync';

/**
 * Delete a remittance record (and its lines, via cascade). For clearing a
 * duplicate or a mistaken entry. Does NOT un-fund any deals — money already
 * recorded on a deal stays as-is; this only removes the remittance bookkeeping.
 */
export async function deleteRemittanceAction(id: string, _formData?: FormData): Promise<void> {
  const session = await requireStaffSection('remittances');
  const r = await prisma.hdRemittance.findUnique({ where: { id }, select: { documentNumber: true, source: true } });
  if (!r) redirect('/staff/remittances');
  await prisma.hdRemittance.delete({ where: { id } });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'HdRemittance',
    entityId: id,
    detail: `Remittance deleted (${r?.documentNumber ?? 'manual'}, ${r?.source ?? '—'})`,
  });
  revalidatePath('/staff/remittances');
  redirect('/staff/remittances');
}

export interface RemittanceActionState {
  error?: string;
  ok?: boolean;
  summary?: string;
}

/**
 * Upload the Home Depot "Remittance Advice" PDF: the portal extracts the text,
 * parses the invoice rows (HD #, invoice date, net amount — a negative net is a
 * chargeback) and the document number/payment date, then processes it exactly
 * like a pasted or webhook remittance. Idempotent by document number.
 */
export async function ingestRemittancePdfAction(_prev: RemittanceActionState, formData: FormData): Promise<RemittanceActionState> {
  const session = await requireStaffSection('remittances');

  const file = formData.get('pdf');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose the Home Depot remittance PDF to upload.' };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { error: 'That file is too large — the remittance advice is normally well under 1 MB.' };
  }

  let text: string;
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const out = await extractText(pdf, { mergePages: true });
    text = out.text;
  } catch (err) {
    console.error('[remittance] PDF read failed', err);
    return { error: 'Could not read that PDF. Make sure it’s the Home Depot remittance advice (not a scan/photo).' };
  }

  const parsed = parseHdRemittanceText(text);
  if (parsed.lines.length === 0) {
    return { error: 'No invoice rows found in that PDF. Is it the Home Depot remittance advice? You can still paste the lines below.' };
  }
  // Double-check: per-row math, full coverage, and reconciliation to HD's printed
  // grand total must all pass before anything is funded.
  if (!parsed.verification.ok) {
    return { error: `Double-check failed — this remittance was NOT processed. ${parsed.verification.issues.join(' ')} Please review the PDF or enter it by hand.` };
  }

  const result = await ingestRemittance({
    documentNumber: parsed.documentNumber,
    documentDate: parsed.documentDate,
    paymentDate: parsed.paymentDate,
    source: 'MANUAL',
    processedById: session.userId,
    lines: parsed.lines,
    grandTotal: parsed.grandTotal, // enables the net-total integrity guard
  });

  if (!result.ok) return { error: result.error || 'Could not process the remittance.' };
  if (result.duplicate) return { error: `This remittance (document #${parsed.documentNumber}) was already processed.` };

  // Email the matched report to the office team (best-effort).
  if (result.remittanceId) await sendRemittanceReport(result.remittanceId);

  revalidatePath('/staff/remittances');
  return {
    ok: true,
    summary: `${result.lineCount} lines · ${result.funded} funded · ${result.partial ?? 0} partial · ${result.chargebacks} chargebacks · ${result.deductions ?? 0} fees · ${result.unmatched.length} unmatched · report emailed`,
  };
}

/**
 * Re-check every previously-UNMATCHED remittance line against the deals that are
 * in the portal NOW, and fund any that have since appeared. Recovers HD payments
 * that came in before their deal existed in the portal (or before its HD # was
 * filled in) — those lines stay unmatched forever otherwise.
 */
export async function reconcileUnmatchedAction(_prev: RemittanceActionState, _formData?: FormData): Promise<RemittanceActionState> {
  const session = await requireStaffSection('remittances');

  const res = await reMatchUnmatchedLines({ actorId: session.userId });

  revalidatePath('/staff/remittances');
  if (res.recovered === 0) {
    return { ok: true, summary: `Checked ${res.scanned} unmatched line${res.scanned === 1 ? '' : 's'} — none match a portal deal yet.` };
  }
  const money = `$${res.amountRecovered.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return {
    ok: true,
    summary: `Recovered ${res.recovered} line${res.recovered === 1 ? '' : 's'} (${money}) · ${res.funded} deal${res.funded === 1 ? '' : 's'} funded${res.partial ? ` · ${res.partial} partial` : ''}.`,
  };
}

/**
 * Manual remittance entry: the reviewer pastes lines (one per row) as
 * `HD ID, amount[, customer name]`. A negative amount is treated as a chargeback.
 */
export async function ingestManualRemittanceAction(_prev: RemittanceActionState, formData: FormData): Promise<RemittanceActionState> {
  const session = await requireStaffSection('remittances');

  const documentNumber = (formData.get('documentNumber') ?? '').toString().trim() || null;
  const paymentDate = (formData.get('paymentDate') ?? '').toString().trim() || null;
  const raw = (formData.get('lines') ?? '').toString();

  const lines: RemittanceLineInput[] = [];
  for (const row of raw.split('\n')) {
    const t = row.trim();
    if (!t) continue;
    // Split on comma or tab; be forgiving about extra spaces.
    const parts = t.split(/[\t,]/).map((p) => p.trim());
    const hdIdNumber = (parts[0] || '').replace(/\D/g, '');
    if (hdIdNumber.length < 8) continue;
    const amount = Number((parts[1] || '').replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(amount) || amount === 0) continue;
    const customerName = parts.slice(2).join(' ').trim() || null;
    lines.push({ hdIdNumber, amount, customerName, isChargeback: amount < 0 });
  }

  if (lines.length === 0) return { error: 'No valid lines found. Use: HD ID, amount, name — one per line.' };

  const result = await ingestRemittance({
    documentNumber,
    paymentDate,
    source: 'MANUAL',
    processedById: session.userId,
    lines,
  });

  if (!result.ok) return { error: result.error || 'Could not process the remittance.' };
  if (result.duplicate) return { error: `Remittance ${documentNumber} was already processed.` };

  if (result.remittanceId) await sendRemittanceReport(result.remittanceId);

  revalidatePath('/staff/remittances');
  return {
    ok: true,
    summary: `${result.lineCount} lines · ${result.funded} funded · ${result.partial ?? 0} partial · ${result.chargebacks} chargebacks · ${result.unmatched.length} unmatched · report emailed`,
  };
}

/**
 * Re-pull ONE remittance from the Home Depot email and fix it: delete the stored
 * record, re-parse the original PDF with the current accurate parser, re-fund,
 * and email the corrected report. For repairing the ones the old Google Apps
 * Script shuffled. Deals already funded stay funded. Needs the HD document number
 * (auto-pulled remittances have it) and Gmail read access.
 */
export async function reprocessRemittanceAction(id: string): Promise<RemittanceActionState> {
  const session = await requireStaffSection('remittances');
  const r = await prisma.hdRemittance.findUnique({ where: { id }, select: { documentNumber: true } });
  if (!r?.documentNumber) {
    return { error: 'This remittance has no Home Depot document number to re-pull by (it was entered manually). Delete it and upload the PDF instead.' };
  }
  const res = await reprocessRemittanceByDoc(r.documentNumber);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'HdRemittance',
    entityId: id,
    detail: `Re-pull from HD email (${r.documentNumber}): ${res.ok ? 'fixed & re-funded' : 'failed'}${res.reason ? ' — ' + res.reason : ''}`,
  });
  if (!res.ok) return { error: res.reason || 'Could not re-pull this remittance from the Home Depot email.' };
  revalidatePath('/staff/remittances');
  // The fixed remittance is a NEW record; send the user back to the list.
  redirect('/staff/remittances');
}

/** Email the matched-remittance report PDF to the office team, on demand. */
export async function emailRemittanceReportAction(id: string): Promise<RemittanceActionState> {
  await requireStaffSection('remittances');
  const res = await sendRemittanceReport(id);
  if (!res.sent) {
    return {
      error: res.reason === 'log-only'
        ? 'Email is in log-only mode on this environment, so nothing was sent.'
        : `Could not send the report${res.reason ? ` — ${res.reason}` : ''}.`,
    };
  }
  return { ok: true, summary: `Report emailed to ${res.to.join(', ')}.` };
}

/** Who the report goes to (default office team, or REMITTANCE_REPORT_RECIPIENTS). */
export async function remittanceReportRecipientsAction(): Promise<string[]> {
  return remittanceReportRecipients();
}

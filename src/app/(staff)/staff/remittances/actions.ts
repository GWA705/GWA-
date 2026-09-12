'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ingestRemittance, parseHdRemittanceText, type RemittanceLineInput } from '@/lib/hdRemittance';

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

  const result = await ingestRemittance({
    documentNumber: parsed.documentNumber,
    documentDate: parsed.documentDate,
    paymentDate: parsed.paymentDate,
    source: 'MANUAL',
    processedById: session.userId,
    lines: parsed.lines,
  });

  if (!result.ok) return { error: result.error || 'Could not process the remittance.' };
  if (result.duplicate) return { error: `This remittance (document #${parsed.documentNumber}) was already processed.` };

  revalidatePath('/staff/remittances');
  return {
    ok: true,
    summary: `${result.lineCount} lines · ${result.funded} funded · ${result.partial ?? 0} partial · ${result.chargebacks} chargebacks · ${result.unmatched.length} unmatched`,
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

  revalidatePath('/staff/remittances');
  return {
    ok: true,
    summary: `${result.lineCount} lines · ${result.funded} funded · ${result.partial ?? 0} partial · ${result.chargebacks} chargebacks · ${result.unmatched.length} unmatched`,
  };
}

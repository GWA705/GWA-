'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffSection } from '@/lib/session';
import { ingestRemittance, type RemittanceLineInput } from '@/lib/hdRemittance';

export interface RemittanceActionState {
  error?: string;
  ok?: boolean;
  summary?: string;
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
    summary: `${result.lineCount} lines · ${result.funded} funded · ${result.chargebacks} chargebacks · ${result.unmatched.length} unmatched`,
  };
}

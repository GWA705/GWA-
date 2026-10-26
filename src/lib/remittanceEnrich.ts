import 'server-only';
import { readJournal } from './reporting/journalRead';

/**
 * Fill in a remittance line's customer / office / store from the SALES JOURNAL
 * when the HD # isn't a portal deal. Most historical deals live only in the
 * journal (Google Sheets), so without this they show as blank "ATTENTION" even
 * though HD clearly paid a real customer. This matches the old Apps Script's
 * journal lookup, so the report fills in like the team expects.
 *
 * Funding is unaffected: a line only advances a portal deal to FUNDED when there
 * is a portal Application (handled in hdRemittance.ts). This is display-only
 * identification for the report + detail view.
 */

const digits = (s: string) => (s || '').replace(/\D/g, '');

export interface JournalMatch {
  customer: string;
  office: string;
  store: string;
}

/** HD # (digits) → journal customer/office/store, newest year wins. */
export async function loadJournalHdRefIndex(years?: number[]): Promise<Map<string, JournalMatch>> {
  const now = new Date().getFullYear();
  const ys = years ?? [now, now - 1, now - 2];
  const reads = await Promise.all(ys.map((y) => readJournal(y).catch(() => null)));
  const idx = new Map<string, JournalMatch>();
  for (const r of reads) {
    if (!r) continue;
    for (const d of r.deals) {
      const k = digits(d.hdRef);
      if (k.length < 8 || idx.has(k)) continue; // first (newest) wins
      const customer = [d.firstName, d.lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ');
      idx.set(k, { customer, office: (d.location || '').trim(), store: d.storeNumber || d.hdStore || '' });
    }
  }
  return idx;
}

export interface LineDisplay {
  customer: string;
  office: string;
  store: string;
  label: 'FUNDED' | 'CHARGEBACK' | 'FEE' | 'IN JOURNAL' | 'ATTENTION';
}

/**
 * Decide what one line shows: a portal deal wins (funded/chargeback with the
 * deal's name); else a deduction is a fee; else fall back to the journal match;
 * else true attention.
 */
export function remittanceLineDisplay(
  line: { status: string; hdIdNumber: string; isChargeback: boolean; customerName?: string | null },
  app: { name: string; office: string; store: string } | null,
  journal: JournalMatch | undefined,
): LineDisplay {
  if (line.status === 'DEDUCTION') {
    return { customer: line.customerName || 'Lead/program fee', office: '—', store: '—', label: 'FEE' };
  }
  if (app) {
    return { customer: app.name || '—', office: app.office || journal?.office || '—', store: app.store || journal?.store || '—', label: line.status === 'CHARGEBACK' ? 'CHARGEBACK' : 'FUNDED' };
  }
  if (line.status === 'CHARGEBACK') {
    return { customer: journal?.customer || line.customerName || '—', office: journal?.office || '—', store: journal?.store || '—', label: 'CHARGEBACK' };
  }
  if (journal && journal.customer) {
    return { customer: journal.customer, office: journal.office || '—', store: journal.store || '—', label: 'IN JOURNAL' };
  }
  return { customer: line.customerName || '—', office: '—', store: '—', label: 'ATTENTION' };
}

import 'server-only';
import type { gmail_v1 } from 'googleapis';
import { gmailReadClient, gmailReadConfigured } from './gmailClient';
import { parseHdRemittanceText, ingestRemittance, type RemittanceResult } from './hdRemittance';
import { sendRemittanceReport } from './remittanceReport';
import { prisma } from './db';

/**
 * Auto-pull Home Depot remittances straight into the portal — the in-portal
 * replacement for the Google Apps Script.
 *
 * It reads the HD "Remittance Advice" emails from the shared read-only mailbox
 * (the same Gmail delegation HD Resolution uses), extracts the PDF text with
 * `unpdf` (NO OCR, so the columns stay intact and amounts can't shuffle), parses
 * each row with its own net, and ingests it. Ingest is idempotent by HD document
 * number, so re-scanning the same inbox is safe and needs no Gmail label writes
 * (hence read-only scope is enough). The grand-total integrity guard in ingest
 * refuses to fund anything if a parse ever fails to reconcile.
 */

const SUBJECT = 'REMITTANCE ADVICE FROM THE HOME DEPOT';

export interface RemittanceSyncResult {
  configured: boolean;
  scannedMessages: number;
  pdfs: number;
  processed: number; // new remittances funded
  duplicates: number; // already-processed documents skipped
  failed: number; // parse/integrity/read failures needing manual review
  funded: number; // deals advanced to FUNDED across this run
  details: { documentNumber: string | null; status: string; summary?: string; error?: string }[];
}

function flattenParts(part?: gmail_v1.Schema$MessagePart): gmail_v1.Schema$MessagePart[] {
  if (!part) return [];
  const out = [part];
  for (const p of part.parts ?? []) out.push(...flattenParts(p));
  return out;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(bytes);
  const out = await extractText(pdf, { mergePages: true });
  return out.text;
}

export async function sweepHdRemittances(opts: { days?: number; max?: number } = {}): Promise<RemittanceSyncResult> {
  const result: RemittanceSyncResult = {
    configured: gmailReadConfigured(), scannedMessages: 0, pdfs: 0, processed: 0, duplicates: 0, failed: 0, funded: 0, details: [],
  };
  if (!result.configured) return result;

  const gmail = gmailReadClient();
  const days = Math.min(60, Math.max(1, opts.days ?? 14));
  const q = `subject:"${SUBJECT}" has:attachment filename:pdf newer_than:${days}d`;
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: Math.min(25, opts.max ?? 25) });
  const msgs = list.data.messages ?? [];
  result.scannedMessages = msgs.length;

  for (const m of msgs) {
    if (!m.id) continue;
    let full: gmail_v1.Schema$Message;
    try {
      const res = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
      full = res.data;
    } catch (e) {
      result.failed += 1;
      result.details.push({ documentNumber: null, status: 'message_read_failed', error: String(e) });
      continue;
    }

    for (const p of flattenParts(full.payload)) {
      const fn = (p.filename || '').toLowerCase();
      const isPdf = fn.endsWith('.pdf') || (p.mimeType || '').toLowerCase().includes('pdf');
      if (!isPdf || !p.body?.attachmentId) continue;
      result.pdfs += 1;

      let text: string;
      try {
        const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: m.id, id: p.body.attachmentId });
        const data = att.data.data || '';
        const bytes = new Uint8Array(Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
        text = await extractPdfText(bytes);
      } catch (e) {
        result.failed += 1;
        result.details.push({ documentNumber: null, status: 'pdf_read_failed', error: String(e) });
        continue;
      }

      const parsed = parseHdRemittanceText(text);
      if (parsed.lines.length === 0) {
        result.failed += 1;
        result.details.push({ documentNumber: parsed.documentNumber, status: 'no_lines' });
        continue;
      }

      let res: RemittanceResult;
      try {
        res = await ingestRemittance({
          documentNumber: parsed.documentNumber,
          documentDate: parsed.documentDate,
          paymentDate: parsed.paymentDate,
          source: 'WEBHOOK',
          lines: parsed.lines,
          grandTotal: parsed.grandTotal, // integrity guard
        });
      } catch (e) {
        result.failed += 1;
        result.details.push({ documentNumber: parsed.documentNumber, status: 'ingest_error', error: String(e) });
        continue;
      }

      if (!res.ok) {
        result.failed += 1;
        result.details.push({ documentNumber: parsed.documentNumber, status: 'integrity_failed', error: res.error });
        continue;
      }
      if (res.duplicate) {
        result.duplicates += 1;
        result.details.push({ documentNumber: parsed.documentNumber, status: 'duplicate' });
        continue;
      }
      result.processed += 1;
      result.funded += res.funded;
      result.details.push({
        documentNumber: parsed.documentNumber,
        status: 'processed',
        summary: `${res.lineCount} lines · ${res.funded} funded · ${res.chargebacks} chargebacks · ${res.deductions ?? 0} fees · ${res.unmatched.length} unmatched`,
      });
      // Email the matched report to the office team (best-effort — never blocks).
      if (res.remittanceId) await sendRemittanceReport(res.remittanceId);
    }
  }

  return result;
}

export interface ReprocessResult {
  ok: boolean;
  reason?: string;
  documentNumber: string;
  deletedOld: boolean;
  result?: RemittanceResult;
}

/**
 * Re-pull ONE remittance from the Home Depot email and correct it: delete the
 * stored (possibly mis-parsed) record, find that document's email again, and
 * re-ingest it with the current, accurate parser — then email the fixed report.
 * Deals already FUNDED stay funded; this corrects the recorded line amounts, the
 * netted fee and the report. Used to fix the ones the old Apps Script shuffled.
 */
export async function reprocessRemittanceByDoc(documentNumber: string, opts: { days?: number } = {}): Promise<ReprocessResult> {
  const doc = (documentNumber || '').trim();
  if (!doc) return { ok: false, reason: 'No document number.', documentNumber, deletedOld: false };
  if (!gmailReadConfigured()) return { ok: false, reason: 'Gmail read access is not configured.', documentNumber: doc, deletedOld: false };

  const gmail = gmailReadClient();
  const days = Math.min(120, Math.max(1, opts.days ?? 60));
  const q = `subject:"${SUBJECT}" has:attachment filename:pdf newer_than:${days}d`;
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 });
  const msgs = list.data.messages ?? [];

  // Find the email whose PDF parses to this document number.
  for (const m of msgs) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }).then((r) => r.data).catch(() => null);
    if (!full) continue;
    for (const p of flattenParts(full.payload)) {
      const fn = (p.filename || '').toLowerCase();
      const isPdf = fn.endsWith('.pdf') || (p.mimeType || '').toLowerCase().includes('pdf');
      if (!isPdf || !p.body?.attachmentId) continue;
      let parsed;
      try {
        const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: m.id, id: p.body.attachmentId });
        const bytes = new Uint8Array(Buffer.from((att.data.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
        parsed = parseHdRemittanceText(await extractPdfText(bytes));
      } catch { continue; }
      if ((parsed.documentNumber || '').trim() !== doc) continue;

      // Found it — delete the stored record (cascade lines), then re-ingest clean.
      const existing = await prisma.hdRemittance.findUnique({ where: { documentNumber: doc }, select: { id: true } });
      let deletedOld = false;
      if (existing) { await prisma.hdRemittance.delete({ where: { id: existing.id } }); deletedOld = true; }

      const result = await ingestRemittance({
        documentNumber: parsed.documentNumber, documentDate: parsed.documentDate, paymentDate: parsed.paymentDate,
        source: 'WEBHOOK', lines: parsed.lines, grandTotal: parsed.grandTotal,
      });
      if (result.ok && !result.duplicate && result.remittanceId) await sendRemittanceReport(result.remittanceId);
      return { ok: result.ok, reason: result.error, documentNumber: doc, deletedOld, result };
    }
  }
  return { ok: false, reason: `No Home Depot email found for document ${doc} in the last ${days} days.`, documentNumber: doc, deletedOld: false };
}

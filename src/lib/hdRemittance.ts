import 'server-only';
import { Prisma, type ApplicationStatus } from '@prisma/client';
import { prisma } from './db';
import { audit } from './audit';
import { parseFlexibleDate } from './dateparse';

/**
 * Home Depot remittance intake.
 *
 * A remittance (arriving Mon/Wed/Fri) lists the invoices HD is paying, keyed by
 * HD ID # — which is the portal's `hdReference` on a deal — plus any chargebacks.
 * Ingesting one:
 *   • matches each line to a deal by hdReference,
 *   • marks a matched, positive deal **FUNDED** (HD has paid it),
 *   • flags chargebacks for the refund flow,
 *   • leaves unmatched lines for a reviewer to chase.
 *
 * IMPORTANT: every dollar figure here is INTERNAL. The amount lives only on the
 * HdRemittanceLine (reviewer/admin views). The funding status-event note is
 * deliberately money-free because status events show on the DEALER's deal page.
 */

// Statuses we never auto-advance from.
const TERMINAL: ApplicationStatus[] = ['DECLINED', 'WITHDRAWN', 'DRAFT'];

export interface RemittanceLineInput {
  hdIdNumber: string;
  amount: number; // signed net; negative (or isChargeback) = chargeback
  customerName?: string | null;
  invoiceDate?: string | null; // MM/DD/YYYY or ISO
  isChargeback?: boolean;
}

export interface RemittanceInput {
  documentNumber?: string | null;
  documentDate?: string | null;
  paymentDate?: string | null;
  source: 'WEBHOOK' | 'MANUAL';
  processedById?: string | null;
  lines: RemittanceLineInput[];
}

export interface RemittanceResult {
  ok: boolean;
  remittanceId?: string;
  duplicate?: boolean;
  lineCount: number;
  matched: number;
  funded: number;
  chargebacks: number;
  unmatched: { hdIdNumber: string; amount: number }[];
  error?: string;
}

const digits = (s: string) => (s || '').replace(/\D/g, '');
function toDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const iso = parseFlexibleDate(raw).iso;
  return iso ? new Date(`${iso}T00:00:00`) : null;
}

export async function ingestRemittance(input: RemittanceInput): Promise<RemittanceResult> {
  const docNumber = (input.documentNumber || '').trim() || null;

  // Dedupe on HD's document number so a re-send (or the webhook + a manual entry)
  // can't fund everything twice.
  if (docNumber) {
    const existing = await prisma.hdRemittance.findUnique({ where: { documentNumber: docNumber }, select: { id: true } });
    if (existing) {
      return { ok: true, duplicate: true, remittanceId: existing.id, lineCount: 0, matched: 0, funded: 0, chargebacks: 0, unmatched: [] };
    }
  }

  const lines = (input.lines || []).filter((l) => l && digits(l.hdIdNumber).length >= 8);
  if (lines.length === 0) return { ok: false, error: 'No valid lines.', lineCount: 0, matched: 0, funded: 0, chargebacks: 0, unmatched: [] };

  // Look up all referenced deals in one query, newest first so a re-used HD number
  // maps to the most recent deal.
  const refs = Array.from(new Set(lines.map((l) => digits(l.hdIdNumber))));
  const apps = await prisma.application.findMany({
    where: { hdReference: { in: refs } },
    select: { id: true, hdReference: true, status: true, applicantFirstName: true, applicantLastName: true },
    orderBy: { createdAt: 'desc' },
  });
  const byRef = new Map<string, (typeof apps)[number]>();
  for (const a of apps) {
    const k = digits(a.hdReference ?? '');
    if (k && !byRef.has(k)) byRef.set(k, a); // first (newest) wins
  }

  const totalNet = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const remittance = await prisma.hdRemittance.create({
    data: {
      documentNumber: docNumber,
      documentDate: toDate(input.documentDate),
      paymentDate: toDate(input.paymentDate),
      totalNet: new Prisma.Decimal(totalNet.toFixed(2)),
      source: input.source,
      processedById: input.processedById ?? null,
      lineCount: lines.length,
    },
  });

  let matched = 0;
  let funded = 0;
  let chargebacks = 0;
  const unmatched: { hdIdNumber: string; amount: number }[] = [];

  for (const l of lines) {
    const ref = digits(l.hdIdNumber);
    const amount = Number(l.amount) || 0;
    const isChargeback = !!l.isChargeback || amount < 0;
    const app = byRef.get(ref);
    let status: 'MATCHED' | 'UNMATCHED' | 'CHARGEBACK' = 'UNMATCHED';
    let fundedNow = false;

    if (isChargeback) {
      chargebacks += 1;
      status = 'CHARGEBACK';
      if (app) {
        // Flag it for the refund flow via an INTERNAL note (never shown to the
        // dealer). If a cancellation is already open, the reviewer can tie the
        // chargeback to it there.
        await prisma.note.create({
          data: {
            applicationId: app.id,
            authorId: input.processedById ?? (await systemActorId()),
            internal: true,
            body: `⚠️ Home Depot chargeback on remittance ${docNumber ?? '(manual)'} — HD clawed back this deal. Review against the cancellation/refund flow.`,
          },
        }).catch(() => {});
      }
    } else if (app) {
      matched += 1;
      status = 'MATCHED';
      if (!TERMINAL.includes(app.status) && app.status !== 'FUNDED') {
        await prisma.$transaction([
          prisma.application.update({ where: { id: app.id }, data: { status: 'FUNDED' } }),
          prisma.statusEvent.create({
            data: {
              applicationId: app.id,
              from: app.status,
              to: 'FUNDED',
              actorId: input.processedById ?? (await systemActorId()),
              // Money-free on purpose — status events show on the dealer's page.
              note: 'Funded — Home Depot payment received',
            },
          }),
        ]);
        funded += 1;
        fundedNow = true;
      }
    } else {
      unmatched.push({ hdIdNumber: ref, amount });
    }

    await prisma.hdRemittanceLine.create({
      data: {
        remittanceId: remittance.id,
        hdIdNumber: ref,
        customerName: (l.customerName || '').toString().slice(0, 120) || null,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        invoiceDate: toDate(l.invoiceDate),
        isChargeback,
        status,
        applicationId: app?.id ?? null,
        fundedNow,
      },
    });
  }

  await prisma.hdRemittance.update({
    where: { id: remittance.id },
    data: { matchedCount: matched, chargebackCount: chargebacks },
  });

  await audit({
    actorId: input.processedById ?? null,
    action: 'STATUS_CHANGE',
    entityType: 'HdRemittance',
    entityId: remittance.id,
    detail: `Remittance ${docNumber ?? '(manual)'}: ${lines.length} lines, ${funded} funded, ${chargebacks} chargebacks, ${unmatched.length} unmatched`,
  });

  return { ok: true, remittanceId: remittance.id, lineCount: lines.length, matched, funded, chargebacks, unmatched };
}

// A fallback actor for system-driven writes (the webhook has no user). Uses the
// first active admin; notes/status-events need a non-null authorId/actorId.
let cachedSystemActor: string | null = null;
async function systemActorId(): Promise<string> {
  if (cachedSystemActor) return cachedSystemActor;
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  cachedSystemActor = admin?.id ?? '';
  return cachedSystemActor;
}

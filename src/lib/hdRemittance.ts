import 'server-only';
import { Prisma, type ApplicationStatus } from '@prisma/client';
import { prisma } from './db';
import { audit } from './audit';
import { parseFlexibleDate } from './dateparse';
import { computeDealerPayout } from './payoutCalc';

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
  partial?: number; // split-payment deals that received a partial HD payment
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

/**
 * Parse the text of a Home Depot "Remittance Advice" PDF into a RemittanceInput.
 *
 * The advice lists one row per invoice as:
 *   <HD ID> <MM/DD/YYYY inv date> <gross> <adjmt> <net>
 * e.g. `800251872 09/09/2026 1,803.26 0.00 1,803.26`. The **net** (last number on
 * the row) is the amount we record; a negative net is a chargeback. The document
 * number / dates come from the header block. HD's advice carries no customer
 * names (those come from the Google matcher), so names are left blank here — the
 * portal still matches each line to a deal by HD #.
 */
export function parseHdRemittanceText(text: string): {
  documentNumber: string | null;
  documentDate: string | null;
  paymentDate: string | null;
  lines: RemittanceLineInput[];
} {
  const grab = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  const documentNumber = grab(/Document Number\/Num[eèé]ro de Document:\s*([0-9]+)/i);
  const documentDate = grab(/Document Date\/Date de Document:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const paymentDate = grab(/Payment Date\/Date de Paiement:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);

  const lines: RemittanceLineInput[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // A data row starts with an 8+ digit HD ID and an invoice date, followed by
    // the money columns. Anything else (headers, totals, the address block) is
    // skipped because it doesn't start with an HD ID + date.
    const m = raw.match(/^\s*(\d{8,})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)$/);
    if (!m) continue;
    const hdIdNumber = m[1];
    const invoiceDate = m[2];
    // The net amount is the last money token on the row (gross, adjmt, NET).
    const nums = m[3].match(/-?\$?[\d,]+\.\d{2}/g);
    if (!nums || nums.length === 0) continue;
    const net = Number(nums[nums.length - 1].replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(net) || net === 0) continue;
    lines.push({ hdIdNumber, amount: net, invoiceDate, isChargeback: net < 0 });
  }

  return { documentNumber, documentDate, paymentDate, lines };
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

  // Content-based dedupe fail-safe: catch a re-entry that used a DIFFERENT (or no)
  // document number — the same set of HD #s + amounts is almost certainly the same
  // remittance (e.g. a manual entry, then the webhook with HD's real doc #). Match
  // against recent remittances with the same line count + net total, then compare
  // the sorted line signature. Skips creating a second record if it's a repeat.
  const sigOf = (ls: { hdIdNumber: string; amount: number | { toString(): string } }[]) =>
    ls
      .map((l) => `${digits(String(l.hdIdNumber))}:${(Number(l.amount) || 0).toFixed(2)}`)
      .sort()
      .join('|');
  const thisSig = sigOf(lines);
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const candidates = await prisma.hdRemittance.findMany({
    where: { createdAt: { gte: since }, lineCount: lines.length, totalNet: new Prisma.Decimal(total.toFixed(2)) },
    select: { id: true, lines: { select: { hdIdNumber: true, amount: true } } },
  });
  for (const c of candidates) {
    if (sigOf(c.lines) === thisSig) {
      return { ok: true, duplicate: true, remittanceId: c.id, lineCount: 0, matched: 0, funded: 0, partial: 0, chargebacks: 0, unmatched: [] };
    }
  }

  // Look up all referenced deals in one query, newest first so a re-used HD number
  // maps to the most recent deal.
  const refs = Array.from(new Set(lines.map((l) => digits(l.hdIdNumber))));
  const apps = await prisma.application.findMany({
    where: { hdReference: { in: refs } },
    select: {
      id: true, hdReference: true, status: true, applicantFirstName: true, applicantLastName: true,
      isSplitPayment: true, province: true, requestedAmount: true, approvedAmount: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const byRef = new Map<string, (typeof apps)[number]>();
  for (const a of apps) {
    const k = digits(a.hdReference ?? '');
    if (k && !byRef.has(k)) byRef.set(k, a); // first (newest) wins
  }

  // Split-payment deals are paid by HD in more than one remittance (e.g. a
  // deposit now, the balance later). They must NOT be marked Funded until the
  // TOTAL received reaches the expected HD payout — otherwise the deposit alone
  // would falsely fund a $10k deal. We track cumulative HD dollars received per
  // deal: prior payments (already on file) + what this remittance adds.
  const appIds = Array.from(new Set(Array.from(byRef.values()).map((a) => a.id)));
  const priorSums = appIds.length
    ? await prisma.hdRemittanceLine.groupBy({
        by: ['applicationId'],
        where: { applicationId: { in: appIds }, isChargeback: false },
        _sum: { amount: true },
      })
    : [];
  const receivedByApp = new Map<string, number>();
  for (const g of priorSums) {
    if (g.applicationId) receivedByApp.set(g.applicationId, Number(g._sum.amount ?? 0));
  }
  // Expected full HD payout for a deal (the EFT amount HD pays on the total sale).
  const expectedPayout = (a: (typeof apps)[number]): number => {
    const total = Number(a.approvedAmount ?? a.requestedAmount) || 0;
    return computeDealerPayout(total, a.province).payout;
  };
  // "Fully paid" once cumulative reaches the expected payout, within a small
  // tolerance (the calculator is an estimate; HD's actual cents can differ).
  const isFullyPaid = (received: number, expected: number): boolean =>
    expected > 0 && received >= expected - Math.max(2, expected * 0.01);

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
  let partial = 0;
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
      // Track cumulative HD dollars received for this deal (prior + this line).
      const received = (receivedByApp.get(app.id) ?? 0) + amount;
      receivedByApp.set(app.id, received);

      if (!TERMINAL.includes(app.status) && app.status !== 'FUNDED') {
        // A split-payment deal only funds once the TOTAL received reaches the
        // expected HD payout; an earlier partial payment leaves it in funding
        // (not Funded) with an internal note, so it isn't marked paid too soon.
        const fullyPaid = !app.isSplitPayment || isFullyPaid(received, expectedPayout(app));
        if (fullyPaid) {
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
        } else {
          // Partial payment on a split deal — record it, keep it in funding, and
          // leave an INTERNAL note (dealer never sees the dollar figures).
          partial += 1;
          const expected = expectedPayout(app);
          await prisma.note.create({
            data: {
              applicationId: app.id,
              authorId: input.processedById ?? (await systemActorId()),
              internal: true,
              body: `💵 Home Depot PARTIAL payment received on this split-payment deal — $${received.toFixed(2)} of ~$${expected.toFixed(2)} expected. NOT marked funded yet; awaiting the remaining HD payment.`,
            },
          }).catch(() => {});
          // Nudge the deal into "in for funding" so it's clearly still open (only
          // if it hasn't already advanced past that point).
          if (['SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED'].includes(app.status)) {
            await prisma.$transaction([
              prisma.application.update({ where: { id: app.id }, data: { status: 'FUNDING_REVIEW' } }),
              prisma.statusEvent.create({
                data: {
                  applicationId: app.id,
                  from: app.status,
                  to: 'FUNDING_REVIEW',
                  actorId: input.processedById ?? (await systemActorId()),
                  note: 'Partial Home Depot payment received — awaiting remainder',
                },
              }),
            ]);
          }
        }
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
    detail: `Remittance ${docNumber ?? '(manual)'}: ${lines.length} lines, ${funded} funded, ${partial} partial, ${chargebacks} chargebacks, ${unmatched.length} unmatched`,
  });

  return { ok: true, remittanceId: remittance.id, lineCount: lines.length, matched, funded, partial, chargebacks, unmatched };
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

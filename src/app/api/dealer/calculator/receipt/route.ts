import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { computeDealerPayout } from '@/lib/payoutCalc';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (r: number) => `${(r * 100).toLocaleString('en-CA', { maximumFractionDigits: 3 })}%`;
const fmtDate = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined;

// Build the fields for an ACTUAL (fully-paid) receipt from server-trusted data.
// Re-queries the deal within the dealer's tenant scope and reads the recorded
// payout — never trusts a client-supplied amount. Returns null if the deal isn't
// the dealer's, or isn't actually paid.
type ActualReceipt = {
  customer?: string; saleDate?: string; reference?: string; products?: string;
  salesperson?: string; installer?: string; paymentLabel?: string; province?: string;
  actualPayout: number; paidOn?: string; method?: string; payoutReference?: string;
};

/**
 * Generate a print-ready PDF of the Dealer Sale & Payout Receipt. For a fully-paid
 * deal ({ dealId, actual:true }) it prints the ACTUAL recorded payout, re-verified
 * server-side. Otherwise it recomputes the estimate from amount + province (never
 * trusts client math). Auth-gated to dealers with calculator access.
 */
export async function POST(req: Request) {
  const user = await requireDealerAccess();
  if (!(await hasCalculatorAccess(user))) return new NextResponse('Forbidden', { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number; province?: string; customer?: string; reference?: string;
    saleDate?: string; products?: string; salesperson?: string; installer?: string; paymentLabel?: string;
    dealId?: string; actual?: boolean;
  };

  // Actual-payout receipt: pull the real figures from the deal + its payouts.
  let act: ActualReceipt | null = null;
  if (body.actual && body.dealId) {
    const app = await prisma.application.findFirst({
      where: { id: body.dealId, ...dealerPortalScopeWhere(user) },
      select: {
        applicantFirstName: true, applicantLastName: true, province: true,
        hdReference: true, financeItNumber: true, dateOfSale: true, productsSold: true,
        salespersonName: true, installerName: true, paymentMethod: true,
        payouts: { select: { amount: true, paidOn: true, method: true, reference: true }, orderBy: { paidOn: 'desc' } },
      },
    });
    if (!app || app.payouts.length === 0) return new NextResponse('Deal not paid', { status: 400 });
    const total = app.payouts.reduce((sum, p) => sum + Number(p.amount), 0);
    const latest = app.payouts[0];
    act = {
      customer: `${app.applicantFirstName} ${app.applicantLastName}`.trim() || undefined,
      saleDate: fmtDate(app.dateOfSale),
      reference: app.hdReference || app.financeItNumber || undefined,
      products: Array.isArray(app.productsSold) && app.productsSold.length ? app.productsSold.filter(Boolean).join(', ') : undefined,
      salesperson: app.salespersonName || undefined,
      installer: app.installerName || undefined,
      paymentLabel: app.paymentMethod ? (PAYMENT_METHOD_LABELS[app.paymentMethod] ?? undefined) : undefined,
      province: app.province,
      actualPayout: total,
      paidOn: fmtDate(latest.paidOn),
      method: latest.method ?? undefined,
      payoutReference: latest.reference ?? undefined,
    };
  }

  const r = act ? null : computeDealerPayout(Number(body.amount), body.province ?? null);
  if (!act) {
    if (!(Number(body.amount) > 0)) return new NextResponse('Invalid amount', { status: 400 });
    if (!r!.ok) return new NextResponse('Cannot compute payout', { status: 400 });
  }

  const t = getT();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.055, 0.169, 0.361);
  const green = rgb(0.059, 0.478, 0.302);
  const gray = rgb(0.42, 0.45, 0.5);
  const line = rgb(0.9, 0.91, 0.93);

  const M = 54;
  let y = 748;
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.12)) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.12)) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color });

  // Header
  text('Georgian Water & Air', M, y, 17, bold, navy); y -= 18;
  text(t('download.receipt.subtitle'), M, y, 11, font, gray); y -= 14;
  text(t('download.receipt.printed', { date: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) }), M, y, 9, font, gray);
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 1.5, color: navy }); y -= 22;

  // Sale details
  const details: [string, string | undefined][] = act
    ? [
        [t('download.receipt.customer'), act.customer],
        [t('download.receipt.dateOfSale'), act.saleDate],
        [t('download.receipt.reference'), act.reference],
        [t('download.receipt.products'), act.products],
        [t('download.receipt.salesRep'), act.salesperson],
        [t('download.receipt.installer'), act.installer],
        [t('download.receipt.paymentMethod'), act.paymentLabel],
        [t('download.receipt.province'), act.province],
      ]
    : [
        [t('download.receipt.customer'), body.customer],
        [t('download.receipt.dateOfSale'), body.saleDate],
        [t('download.receipt.reference'), body.reference],
        [t('download.receipt.products'), body.products],
        [t('download.receipt.salesRep'), body.salesperson],
        [t('download.receipt.installer'), body.installer],
        [t('download.receipt.paymentMethod'), body.paymentLabel],
        [t('download.receipt.province'), r!.province ?? undefined],
      ];
  for (const [k, v] of details) {
    if (!v) continue;
    text(k, M, y, 10, font, gray);
    text(String(v).slice(0, 70), M + 150, y, 10, bold);
    y -= 17;
  }
  y -= 8;

  if (act) {
    // Actual-payout receipt — the confirmed amount paid.
    text(t('download.receipt.paymentSection'), M, y, 9, bold, gray); y -= 16;
    const payRows: [string, string][] = [
      [t('download.receipt.datePaid'), act.paidOn ?? '—'],
      [t('download.receipt.method'), act.method ?? '—'],
      [t('download.receipt.paymentReference'), act.payoutReference ?? '—'],
    ];
    for (const [k, v] of payRows) {
      text(k, M, y, 10);
      right(v, 612 - M, y, 10);
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: line });
      y -= 12;
    }
    y -= 4;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: 612 - M, y: y + 8 }, thickness: 1.5, color: green });
    text(t('download.receipt.payoutPaid'), M, y - 8, 12, bold, green);
    right(money(act.actualPayout), 612 - M, y - 8, 13, bold, green);
    y -= 40;
    text(t('download.receipt.actualNote'), M, y, 8, font, gray);
  } else {
    // Estimate receipt — recomputed HD breakdown.
    text(t('download.receipt.breakdownSection'), M, y, 9, bold, gray); y -= 16;
    const rows: [string, string][] = [
      [t('download.receipt.totalWithTax'), money(r!.totalWithTax)],
      [t('download.receipt.subtotalPreTax'), money(r!.subtotal)],
      [t('download.receipt.hdDiscount'), `-${money(r!.hdDiscount)}`],
      [t('download.receipt.afterHdDiscount'), money(r!.afterHd)],
      [t('download.receipt.ibxDiscount'), `-${money(r!.ibxDiscount)}`],
      [t('download.receipt.afterIbxDiscount'), money(r!.afterIbx)],
      [t('download.receipt.hdProgram'), `-${money(r!.hdProgram)}`],
      [t('download.receipt.netPreTax'), money(r!.netPreTax)],
      [t('download.receipt.hstTax', { pct: pct(r!.taxRate) }), `+${money(r!.hst)}`],
    ];
    for (const [k, v] of rows) {
      text(k, M, y, 10);
      right(v, 612 - M, y, 10);
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: line });
      y -= 12;
    }
    y -= 4;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: 612 - M, y: y + 8 }, thickness: 1.5, color: green });
    text(t('download.receipt.totalEftPayout'), M, y - 8, 12, bold, green);
    right(money(r!.payout), 612 - M, y - 8, 13, bold, green);
    y -= 40;
    text(t('download.receipt.estimateNote'), M, y, 8, font, gray);
  }

  const bytes = await pdf.save();
  const slug = ((act ? act.customer : body.customer) || (act ? act.reference : body.reference) || 'receipt').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="gwa-payout-${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

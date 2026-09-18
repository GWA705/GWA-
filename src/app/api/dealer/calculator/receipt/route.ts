import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { computeDealerPayout } from '@/lib/payoutCalc';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';

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
  text('Dealer Sale & Payout Receipt', M, y, 11, font, gray); y -= 14;
  text(`Printed ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, y, 9, font, gray);
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 1.5, color: navy }); y -= 22;

  // Sale details
  const details: [string, string | undefined][] = act
    ? [
        ['Customer', act.customer],
        ['Date of sale', act.saleDate],
        ['Reference / deal #', act.reference],
        ['Products sold', act.products],
        ['Sales rep', act.salesperson],
        ['Installer', act.installer],
        ['Payment method', act.paymentLabel],
        ['Province', act.province],
      ]
    : [
        ['Customer', body.customer],
        ['Date of sale', body.saleDate],
        ['Reference / deal #', body.reference],
        ['Products sold', body.products],
        ['Sales rep', body.salesperson],
        ['Installer', body.installer],
        ['Payment method', body.paymentLabel],
        ['Province', r!.province ?? undefined],
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
    text('PAYMENT', M, y, 9, bold, gray); y -= 16;
    const payRows: [string, string][] = [
      ['Date paid', act.paidOn ?? '—'],
      ['Method', act.method ?? '—'],
      ['Reference', act.payoutReference ?? '—'],
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
    text('PAYOUT PAID', M, y - 8, 12, bold, green);
    right(money(act.actualPayout), 612 - M, y - 8, 13, bold, green);
    y -= 40;
    text('Actual payout paid to your office by Georgian Water & Air. Recorded from the sales journal.', M, y, 8, font, gray);
  } else {
    // Estimate receipt — recomputed HD breakdown.
    text('PAYOUT BREAKDOWN', M, y, 9, bold, gray); y -= 16;
    const rows: [string, string][] = [
      ['Total sale (with tax)', money(r!.totalWithTax)],
      ['Subtotal (pre-tax)', money(r!.subtotal)],
      ['HD Discount (13%)', `-${money(r!.hdDiscount)}`],
      ['Subtotal after HD Discount', money(r!.afterHd)],
      ['HD IBX Discount (1.25%)', `-${money(r!.ibxDiscount)}`],
      ['Subtotal after IBX Discount', money(r!.afterIbx)],
      ['HD Program (4%)', `-${money(r!.hdProgram)}`],
      ['Net payout (pre-tax)', money(r!.netPreTax)],
      [`HST / Tax (${pct(r!.taxRate)})`, `+${money(r!.hst)}`],
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
    text('TOTAL EFT PAYOUT', M, y - 8, 12, bold, green);
    right(money(r!.payout), 612 - M, y - 8, 13, bold, green);
    y -= 40;
    text('Estimate for your records. The amount paid is confirmed by Georgian Water & Air when the deal funds.', M, y, 8, font, gray);
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

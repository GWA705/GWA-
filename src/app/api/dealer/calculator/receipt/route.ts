import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { computeDealerPayout } from '@/lib/payoutCalc';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (r: number) => `${(r * 100).toLocaleString('en-CA', { maximumFractionDigits: 3 })}%`;

/**
 * Generate a print-ready PDF of the Dealer Sale & Payout Receipt. The payout is
 * recomputed server-side from the amount + province (never trusts client math).
 * Auth-gated to dealers with calculator access.
 */
export async function POST(req: Request) {
  const user = await requireDealerAccess();
  if (!(await hasCalculatorAccess(user))) return new NextResponse('Forbidden', { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number; province?: string; customer?: string; reference?: string;
    saleDate?: string; products?: string; salesperson?: string; installer?: string; paymentLabel?: string;
  };
  const amount = Number(body.amount);
  if (!(amount > 0)) return new NextResponse('Invalid amount', { status: 400 });
  const r = computeDealerPayout(amount, body.province ?? null);
  if (!r.ok) return new NextResponse('Cannot compute payout', { status: 400 });

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
  const details: [string, string | undefined][] = [
    ['Customer', body.customer],
    ['Date of sale', body.saleDate],
    ['Reference / deal #', body.reference],
    ['Products sold', body.products],
    ['Sales rep', body.salesperson],
    ['Installer', body.installer],
    ['Payment method', body.paymentLabel],
    ['Province', r.province ?? undefined],
  ];
  for (const [k, v] of details) {
    if (!v) continue;
    text(k, M, y, 10, font, gray);
    text(String(v).slice(0, 70), M + 150, y, 10, bold);
    y -= 17;
  }
  y -= 8;

  // Breakdown
  text('PAYOUT BREAKDOWN', M, y, 9, bold, gray); y -= 16;
  const rows: [string, string][] = [
    ['Total sale (with tax)', money(r.totalWithTax)],
    ['Subtotal (pre-tax)', money(r.subtotal)],
    ['HD Discount (13%)', `-${money(r.hdDiscount)}`],
    ['Subtotal after HD Discount', money(r.afterHd)],
    ['HD IBX Discount (1.25%)', `-${money(r.ibxDiscount)}`],
    ['Subtotal after IBX Discount', money(r.afterIbx)],
    ['HD Program (4%)', `-${money(r.hdProgram)}`],
    ['Net payout (pre-tax)', money(r.netPreTax)],
    [`HST / Tax (${pct(r.taxRate)})`, `+${money(r.hst)}`],
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
  right(money(r.payout), 612 - M, y - 8, 13, bold, green);
  y -= 40;

  text('Estimate for your records. The amount paid is confirmed by Georgian Water & Air when the deal funds.', M, y, 8, font, gray);

  const bytes = await pdf.save();
  const slug = (body.customer || body.reference || 'receipt').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="gwa-payout-${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

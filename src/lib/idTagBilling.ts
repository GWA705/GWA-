import { prisma } from './db';
import type { OfficeEntuitiveProfile } from './idTag';

/**
 * Home Depot ID-tag billing. Each rep activated in a month is billed at a flat
 * per-name price plus the office's LOCAL PROVINCIAL tax (driven by the office's
 * Entuitive profile province). History is computed on demand from the
 * activation timestamps, so any past month can be re-opened and re-invoiced.
 */

export const ID_TAG_UNIT_PRICE_CENTS = 3500; // $35.00 per rep activated

interface TaxInfo { rate: number; label: string }

// Combined sales-tax rate on a service invoice, by province.
const PROVINCE_TAX: Record<string, TaxInfo> = {
  ON: { rate: 0.13, label: 'HST 13%' },
  NB: { rate: 0.15, label: 'HST 15%' },
  NL: { rate: 0.15, label: 'HST 15%' },
  NS: { rate: 0.15, label: 'HST 15%' },
  PE: { rate: 0.15, label: 'HST 15%' },
  BC: { rate: 0.12, label: 'GST+PST 12%' },
  MB: { rate: 0.12, label: 'GST+PST 12%' },
  SK: { rate: 0.11, label: 'GST+PST 11%' },
  QC: { rate: 0.14975, label: 'GST+QST 14.975%' },
  AB: { rate: 0.05, label: 'GST 5%' },
  NT: { rate: 0.05, label: 'GST 5%' },
  NU: { rate: 0.05, label: 'GST 5%' },
  YT: { rate: 0.05, label: 'GST 5%' },
};

const NAME_TO_CODE: Record<string, string> = {
  'ontario': 'ON', 'new brunswick': 'NB', 'newfoundland': 'NL', 'newfoundland and labrador': 'NL',
  'nova scotia': 'NS', 'prince edward island': 'PE', 'british columbia': 'BC', 'manitoba': 'MB',
  'saskatchewan': 'SK', 'quebec': 'QC', 'québec': 'QC', 'alberta': 'AB',
  'northwest territories': 'NT', 'nunavut': 'NU', 'yukon': 'YT',
};

/** Resolve a province string (name or 2-letter code) to its tax. Defaults ON. */
export function provinceTax(province?: string | null): TaxInfo & { code: string } {
  const raw = (province || '').trim();
  let code = raw.length === 2 ? raw.toUpperCase() : (NAME_TO_CODE[raw.toLowerCase()] || '');
  if (!PROVINCE_TAX[code]) code = 'ON';
  return { code, ...PROVINCE_TAX[code] };
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export interface BillingPerson { id: string; name: string; activatedAt: Date; createdBy: string }
export interface OfficeBill {
  dealerId: string;
  office: string;
  province: string;
  taxCode: string;
  taxLabel: string;
  taxRate: number;
  count: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  people: BillingPerson[];
}
export interface MonthlyBilling { month: string; offices: OfficeBill[]; totalCents: number; count: number }

/** Previous month key (YYYY-MM) relative to `now`. */
export function previousMonthKey(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Billing rollup for a month ('YYYY-MM'), grouped by office. */
export async function monthlyActivations(month: string): Promise<MonthlyBilling> {
  const start = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(start.getTime())) return { month, offices: [], totalCents: 0, count: 0 };
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const rows = await prisma.homeDepotIdTag.findMany({
    where: { activatedAt: { gte: start, lt: end } },
    select: {
      id: true, personName: true, activatedAt: true, submittedById: true, dealerId: true,
      dealer: { select: { name: true, idTagOfficeProfile: true } },
    },
    orderBy: { activatedAt: 'asc' },
  });

  const userIds = Array.from(new Set(rows.map((r) => r.submittedById).filter((x): x is string => !!x)));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userName = new Map(users.map((u) => [u.id, u.name || u.email || '—']));

  const byDealer = new Map<string, OfficeBill>();
  for (const r of rows) {
    const prof = r.dealer?.idTagOfficeProfile;
    const province = (prof && typeof prof === 'object' && !Array.isArray(prof) ? (prof as OfficeEntuitiveProfile).province : '') || '';
    let bill = byDealer.get(r.dealerId);
    if (!bill) {
      const tax = provinceTax(province);
      bill = {
        dealerId: r.dealerId, office: r.dealer?.name || '', province: province || tax.code,
        taxCode: tax.code, taxLabel: tax.label, taxRate: tax.rate,
        count: 0, subtotalCents: 0, taxCents: 0, totalCents: 0, people: [],
      };
      byDealer.set(r.dealerId, bill);
    }
    bill.people.push({
      id: r.id, name: r.personName, activatedAt: r.activatedAt as Date,
      createdBy: r.submittedById ? (userName.get(r.submittedById) || '—') : '—',
    });
    bill.count += 1;
  }

  let totalCents = 0;
  let count = 0;
  const offices = Array.from(byDealer.values())
    .map((b) => {
      b.subtotalCents = b.count * ID_TAG_UNIT_PRICE_CENTS;
      b.taxCents = Math.round(b.subtotalCents * b.taxRate);
      b.totalCents = b.subtotalCents + b.taxCents;
      totalCents += b.totalCents;
      count += b.count;
      return b;
    })
    .sort((a, b) => a.office.localeCompare(b.office));

  return { month, offices, totalCents, count };
}

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
}

/** A printable, co-branded invoice PDF for one office + month (greyscale per the
 *  brand kit until the palette is confirmed). */
export async function buildIdTagInvoicePdf(bill: OfficeBill, month: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.42, 0.45, 0.5);
  const line = rgb(0.85, 0.86, 0.88);
  const left = 54;
  const right = 558;
  let y = 740;

  const text = (s: string, x: number, yy: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const rightText = (s: string, xr: number, yy: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color });

  // Header
  text('Georgian Water & Air', left, y, 18, bold);
  rightText('INVOICE', right, y, 18, bold);
  y -= 16;
  text('Authorized Home Depot Home Services Installer', left, y, 9, font, muted);
  rightText('Home Depot ID Tags', right, y, 9, font, muted);
  y -= 28;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 24;

  // Bill-to + meta
  text('Billed to', left, y, 9, bold, muted);
  rightText('Billing period', right, y, 9, bold, muted);
  y -= 15;
  text(bill.office || '—', left, y, 12, bold);
  rightText(monthLabel(month), right, y, 12, bold);
  y -= 14;
  text(`Province: ${bill.province} · ${bill.taxLabel}`, left, y, 9, font, muted);
  y -= 30;

  // Table header
  const cName = left, cDate = 280, cBy = 400, cAmt = right;
  text('Rep activated', cName, y, 9, bold, muted);
  text('Activated', cDate, y, 9, bold, muted);
  text('Created by', cBy, y, 9, bold, muted);
  rightText('Amount', cAmt, y, 9, bold, muted);
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 16;

  for (const p of bill.people) {
    if (y < 120) {
      page = pdf.addPage([612, 792]);
      y = 740;
      text('Rep activated', cName, y, 9, bold, muted);
      text('Activated', cDate, y, 9, bold, muted);
      text('Created by', cBy, y, 9, bold, muted);
      rightText('Amount', cAmt, y, 9, bold, muted);
      y -= 8;
      page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
      y -= 16;
    }
    const when = new Date(p.activatedAt).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    text(p.name.slice(0, 38), cName, y, 10);
    text(when, cDate, y, 9, font, muted);
    text(p.createdBy.slice(0, 22), cBy, y, 9, font, muted);
    rightText(money(ID_TAG_UNIT_PRICE_CENTS), cAmt, y, 10);
    y -= 18;
  }

  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 22;

  // Totals
  const totalsX = 360;
  const row = (label: string, val: string, f = font) => {
    text(label, totalsX, y, 10, f, muted);
    rightText(val, right, y, 10, f);
    y -= 18;
  };
  row(`${bill.count} rep${bill.count === 1 ? '' : 's'} × ${money(ID_TAG_UNIT_PRICE_CENTS)}`, money(bill.subtotalCents));
  row(bill.taxLabel, money(bill.taxCents));
  y -= 2;
  page.drawLine({ start: { x: totalsX, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 1, color: line });
  row('Total', money(bill.totalCents), bold);

  // Footer
  text('Georgian Water & Air · Home Depot ID Tag program', left, 60, 8, font, muted);
  text(`Generated ${new Date().toLocaleDateString('en-CA')}`, left, 48, 8, font, muted);

  return pdf.save();
}

import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { prisma } from './db';
import { sendEmail } from './email';
import { loadJournalHdRefIndex, remittanceLineDisplay } from './remittanceEnrich';

/**
 * The matched Home Depot remittance report — a clean PDF for the office team,
 * built in-portal from the recorded remittance lines (so it can never disagree
 * with what was funded). Emailed to the office recipients whenever a remittance
 * is processed (auto-pull or manual upload).
 */

const SLATE = rgb(0.071, 0.204, 0.282);
const INK = rgb(0.1, 0.1, 0.1);
const MUTE = rgb(0.45, 0.45, 0.45);
const TINT = rgb(0.933, 0.953, 0.965);
const RED = rgb(0.8, 0, 0);

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/** Who gets the report. Hard default is the office team; overridable via env. */
export function remittanceReportRecipients(): string[] {
  const env = (process.env.REMITTANCE_REPORT_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return env.length ? env : ['Vanita@ghsbarrie.ca', 'jj@ghsbarrie.ca', 'Alex@ghsbarrie.ca', 'Sean@ghsbarrie.ca'];
}

interface ReportRow {
  invoiceDate: Date | null;
  hdId: string;
  customer: string;
  office: string;
  store: string;
  amount: number;
  statusLabel: string;
}
interface ReportMeta {
  documentNumber: string | null;
  paymentDate: Date | null;
  totalNet: number;
  lineCount: number;
}

export function buildRemittanceReportPdf(rows: ReportRow[], meta: ReportMeta): Promise<Uint8Array> {
  return (async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 612, H = 792, M = 42;
    let page: PDFPage = doc.addPage([W, H]);
    let y = H - M;

    const text = (s: string, x: number, size: number, f: PDFFont = font, color = INK) => page.drawText(s, { x, y, size, font: f, color });
    const rightText = (s: string, xr: number, size: number, f: PDFFont = font, color = INK) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color });
    const clip = (s: string, maxW: number, size: number, f: PDFFont) => {
      if (f.widthOfTextAtSize(s, size) <= maxW) return s;
      let t = s;
      while (t.length > 1 && f.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
      return t + '…';
    };
    const ensure = (need: number) => { if (y - need < M) { page = doc.addPage([W, H]); y = H - M; } };

    // Header
    text('GEORGIAN WATER & AIR', M, 11, bold, rgb(0.2, 0.2, 0.2));
    y -= 22;
    text('Home Depot Remittance — Matched Report', M, 18, bold, rgb(0.06, 0.06, 0.06));
    y -= 14;
    text(`Document ${meta.documentNumber ?? '(manual)'}   ·   Payment date ${fmtDate(meta.paymentDate)}   ·   Generated ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, 9, font, MUTE);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2, color: SLATE });
    y -= 22;

    // Headline figures
    const fundedCount = rows.filter((r) => r.statusLabel === 'FUNDED').length;
    const feeCount = rows.filter((r) => r.statusLabel === 'FEE').length;
    const cbCount = rows.filter((r) => r.statusLabel === 'CHARGEBACK').length;
    text('NET PAYMENT', M, 8, bold, MUTE);
    text(`${rows.length} lines`, 200, 8, bold, MUTE);
    rightText('FUNDED / FEES / CHARGEBACKS', W - M, 8, bold, MUTE);
    y -= 18;
    text(money(meta.totalNet), M, 20, bold, INK);
    rightText(`${fundedCount}  /  ${feeCount}  /  ${cbCount}`, W - M, 16, bold, INK);
    y -= 24;

    // Columns
    const cDate = M, cId = 112, cCust = 188, cOffice = 330, cStore = 404, cAmt = 512, cStat = W - M;
    const header = () => {
      page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: TINT });
      text('Inv date', cDate + 2, 8, bold, SLATE);
      text('HD ID #', cId, 8, bold, SLATE);
      text('Customer', cCust, 8, bold, SLATE);
      text('Office', cOffice, 8, bold, SLATE);
      text('Store', cStore, 8, bold, SLATE);
      rightText('Amount', cAmt, 8, bold, SLATE);
      rightText('Status', cStat, 8, bold, SLATE);
      y -= 20;
    };
    ensure(40); header();

    for (const r of rows) {
      ensure(16);
      if (y === H - M) header();
      const neg = r.amount < 0;
      text(fmtDate(r.invoiceDate), cDate + 2, 8.5, font);
      text(clip(r.hdId, 70, 8.5, font), cId, 8.5, font);
      text(clip(r.customer || '—', 136, 8.5, font), cCust, 8.5, font);
      text(clip(r.office || '—', 70, 8.5, font), cOffice, 8.5, font);
      text(clip(r.store || '—', 100, 8.5, font), cStore, 8.5, font);
      rightText(money(r.amount), cAmt, 8.5, font, neg ? RED : INK);
      const stColor = r.statusLabel === 'FUNDED' ? rgb(0.1, 0.45, 0.2)
        : r.statusLabel === 'FEE' ? rgb(0.4, 0.2, 0.55)
        : r.statusLabel === 'IN JOURNAL' ? rgb(0.15, 0.35, 0.6)
        : RED;
      rightText(r.statusLabel, cStat, 8, bold, stColor);
      y -= 14;
      page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.92) });
    }
    ensure(20);
    text('NET TOTAL', M + 2, 10, bold);
    rightText(money(meta.totalNet), cAmt, 10, bold);
    y -= 24;

    // Summary by office
    const byOffice = new Map<string, { lines: number; total: number; charge: number; chargeLines: number }>();
    for (const r of rows) {
      const k = r.office && r.office !== '—' ? r.office : 'Unassigned / fees';
      const b = byOffice.get(k) ?? { lines: 0, total: 0, charge: 0, chargeLines: 0 };
      b.lines += 1; b.total += r.amount;
      if (r.statusLabel === 'CHARGEBACK') { b.charge += r.amount; b.chargeLines += 1; }
      byOffice.set(k, b);
    }
    ensure(24);
    text('Summary by office', M, 10, bold, SLATE);
    y -= 16;
    for (const [office, v] of Array.from(byOffice.entries()).sort((a, b) => b[1].total - a[1].total)) {
      ensure(v.charge < 0 ? 26 : 14);
      text(clip(office, 300, 9, font), M + 2, 9, font);
      rightText(`${v.lines} lines`, cAmt - 70, 9, font, MUTE);
      rightText(money(v.total), cStat, 9, font, v.total < 0 ? RED : INK);
      y -= 12;
      // Surface any chargeback(s) even when the office nets positive, so a
      // clawback is never hidden inside a positive total.
      if (v.charge < 0) {
        text(`incl. ${v.chargeLines} chargeback${v.chargeLines === 1 ? '' : 's'} ${money(v.charge)}`, M + 12, 8, font, RED);
        y -= 12;
      }
    }

    const pages = doc.getPages();
    pages.forEach((p, i) => {
      p.drawText('Georgian Water & Air · Home Depot Remittance Match · Confidential', { x: M, y: 24, size: 7.5, font, color: MUTE });
      const pn = `${i + 1} / ${pages.length}`;
      p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 7.5), y: 24, size: 7.5, font, color: MUTE });
    });

    return doc.save();
  })();
}

/**
 * Load one remittance and build its matched-report PDF (no email). Shared by the
 * downloader (view the PDF now) and the emailer (send it to the office team).
 */
export async function buildRemittanceReportForId(
  remittanceId: string,
): Promise<{ pdf: Uint8Array; filename: string; subject: string; html: string } | null> {
  const r = await prisma.hdRemittance.findUnique({
    where: { id: remittanceId },
    include: {
      lines: {
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        include: {
          application: {
            select: {
              applicantFirstName: true, applicantLastName: true,
              dealer: { select: { name: true } },
              homeDepotStore: { select: { number: true } },
            },
          },
        },
      },
    },
  });
  if (!r) return null;

  // Fill unmatched lines from the sales journal (most historical deals live there,
  // not as portal applications).
  const digits = (s: string) => (s || '').replace(/\D/g, '');
  const journalIdx = await loadJournalHdRefIndex();
  const rows: ReportRow[] = r.lines.map((l) => {
    const app = l.application
      ? { name: `${l.application.applicantFirstName} ${l.application.applicantLastName}`.trim(), office: l.application.dealer?.name ?? '', store: l.application.homeDepotStore?.number ?? '' }
      : null;
    const d = remittanceLineDisplay(l, app, journalIdx.get(digits(l.hdIdNumber)));
    return { invoiceDate: l.invoiceDate, hdId: l.hdIdNumber, customer: d.customer, office: d.office, store: d.store, amount: Number(l.amount), statusLabel: d.label };
  });

  const totalNet = Number(r.totalNet ?? rows.reduce((s, x) => s + x.amount, 0));
  const pdf = await buildRemittanceReportPdf(rows, {
    documentNumber: r.documentNumber, paymentDate: r.paymentDate, totalNet, lineCount: r.lineCount,
  });

  const attention = rows.filter((x) => x.statusLabel === 'ATTENTION').length;
  const fundedCount = rows.filter((x) => x.statusLabel === 'FUNDED').length;
  const subject = `GWA Home Depot Remittance — ${money(totalNet)} — doc ${r.documentNumber ?? '(manual)'}${attention ? ` — ⚠ ${attention} need attention` : ''}`;
  const html = `
    <p>The attached report matches Home Depot remittance <b>${r.documentNumber ?? '(manual)'}</b> (payment date ${fmtDate(r.paymentDate)}).</p>
    <p><b>Net payment: ${money(totalNet)}</b> · ${r.lineCount} lines · ${fundedCount} funded${attention ? ` · <b style="color:#b00">${attention} need attention</b>` : ''}.</p>
    <p>Every amount is taken straight from the funded line in the portal, so it reconciles to Home Depot's own grand total.</p>`;

  return { pdf, filename: `GWA_Remittance_${r.documentNumber ?? 'manual'}.pdf`, subject, html };
}

/**
 * Build and email the matched-remittance report for one remittance. Best-effort:
 * returns {sent, to} and never throws, so a mail hiccup can't undo the funding.
 */
export async function sendRemittanceReport(remittanceId: string, to?: string[]): Promise<{ sent: boolean; to: string[]; reason?: string }> {
  const recipients = (to && to.length ? to : remittanceReportRecipients());
  try {
    const built = await buildRemittanceReportForId(remittanceId);
    if (!built) return { sent: false, to: recipients, reason: 'not found' };
    const res = await sendEmail({
      to: recipients.join(', '),
      subject: built.subject,
      html: built.html,
      attachments: [{ filename: built.filename, content: Buffer.from(built.pdf) }],
    });
    return { sent: res.sent, to: recipients, reason: res.reason };
  } catch (e) {
    console.error('[remittanceReport] send failed', e);
    return { sent: false, to: recipients, reason: String(e) };
  }
}

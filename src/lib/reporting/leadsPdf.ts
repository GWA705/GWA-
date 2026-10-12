import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { LeadsReport } from './leadsReport';
import type { TFunction } from '@/i18n/translator';

const SLATE = rgb(0.071, 0.204, 0.282); // #123448
const INK = rgb(0.1, 0.1, 0.1);
const MUTE = rgb(0.45, 0.45, 0.45);
const TINT = rgb(0.933, 0.953, 0.965); // #eef3f6

/** Compose the Leads report as a real PDF (pdf-lib — no browser needed). */
export async function buildLeadsPdf(
  report: LeadsReport,
  opts: { brandName: string; title: string; periodLabel?: string; generated: string; footer: string; t: TFunction },
): Promise<Buffer> {
  const t = opts.t;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 48;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size: number, f: PDFFont = font, color = INK) => page.drawText(s, { x, y, size, font: f, color });
  const rightText = (s: string, xRight: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const truncate = (s: string, maxW: number, size: number, f: PDFFont) => {
    if (f.widthOfTextAtSize(s, size) <= maxW) return s;
    let t = s;
    while (t.length > 1 && f.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
    return t + '…';
  };
  const ensure = (need: number) => {
    if (y - need < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };

  // Header
  text(opts.brandName.toUpperCase(), M, 11, bold, rgb(0.2, 0.2, 0.2));
  y -= 22;
  text(opts.title, M, 20, bold, rgb(0.06, 0.06, 0.06));
  y -= 15;
  text([opts.periodLabel, t('download.leadsPdf.generated', { date: opts.generated })].filter(Boolean).join('   ·   '), M, 9, font, MUTE);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2, color: SLATE });
  y -= 26;

  if (!report.configured || report.error) {
    text(report.error || t('download.leadsPdf.notConnected'), M, 11, font, INK);
    return Buffer.from(await doc.save());
  }

  const g = report.group;
  const contacted = g.total - g.outcomes.notCalled;
  const won = g.outcomes.booked + g.outcomes.sold;

  // KPI row
  const kpis: [string, string][] = [
    [t('download.leadsPdf.kpiTotalLeads'), String(g.total)],
    [t('download.leadsPdf.kpiNoGood'), String(g.noGood)],
    [t('download.leadsPdf.kpiBookedSold'), String(won)],
    [t('download.leadsPdf.kpiDealers'), String(g.dealers)],
  ];
  const cellW = (W - 2 * M) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * cellW;
    page.drawText(label, { x, y, size: 8, font: bold, color: MUTE });
    page.drawText(value, { x, y: y - 20, size: 20, font: bold, color: INK });
  });
  y -= 44;

  // Call activity
  text(t('download.leadsPdf.callActivity'), M, 8, bold, MUTE);
  y -= 14;
  const o = g.outcomes;
  text(t('download.leadsPdf.activityLine', { notCalled: o.notCalled, na: o.na, lm: o.lm, spoke: o.spoke, booked: o.booked, sold: o.sold, ni: o.ni }), M, 9.5, font, INK);
  y -= 12;
  text(t('download.leadsPdf.contactedOf', { contacted, total: g.total }), M, 9, font, MUTE);
  y -= 22;

  // Leads by type (top 6)
  if (g.byKind.length) {
    text(t('download.leadsPdf.leadsByType'), M, 8, bold, MUTE);
    y -= 14;
    for (const k of g.byKind.slice(0, 6)) {
      ensure(14);
      const pct = g.total ? Math.round((k.count / g.total) * 100) : 0;
      text(truncate(k.kind, 340, 10, font), M, 10, font);
      rightText(`${k.count}   ${pct}%`, W - M, 10, font, INK);
      y -= 14;
    }
    y -= 10;
  }

  // Per-dealer table
  const colLeads = 372;
  const colContacted = 444;
  const colWon = 508;
  const colNoGood = W - M; // 564
  const drawTableHeader = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: TINT });
    text(t('download.leadsPdf.colOffice'), M + 4, 8, bold, SLATE);
    rightText(t('download.leadsPdf.colLeads'), colLeads, 8, bold, SLATE);
    rightText(t('download.leadsPdf.colContacted'), colContacted, 8, bold, SLATE);
    rightText(t('download.leadsPdf.colBkdSold'), colWon, 8, bold, SLATE);
    rightText(t('download.leadsPdf.colNoGood'), colNoGood, 8, bold, SLATE);
    y -= 20;
  };
  ensure(60);
  drawTableHeader();

  for (const d of report.dealers) {
    ensure(18);
    if (y === H - M) drawTableHeader(); // just started a fresh page
    const dContacted = d.total - d.outcomes.notCalled;
    const dWon = d.outcomes.booked + d.outcomes.sold;
    text(truncate(d.dealerName, 300, 10, font), M + 4, 10, font);
    rightText(String(d.total), colLeads, 10, font);
    rightText(String(dContacted), colContacted, 10, font);
    rightText(String(dWon), colWon, 10, font);
    rightText(String(d.noGood), colNoGood, 10, font);
    y -= 15;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.92) });
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(opts.footer, { x: M, y: 28, size: 8, font, color: MUTE });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 8), y: 28, size: 8, font, color: MUTE });
  });

  return Buffer.from(await doc.save());
}

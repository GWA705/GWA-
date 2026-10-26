import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ProjectionResult } from './salesProjection';
import type { TFunction } from '@/i18n/translator';

const SLATE = rgb(0.071, 0.204, 0.282); // #123448 — matches the other report PDFs
const INK = rgb(0.1, 0.1, 0.1);
const MUTE = rgb(0.45, 0.45, 0.45);
const TINT = rgb(0.933, 0.953, 0.965); // #eef3f6

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

/** The method + confidence + disclaimer lines, same copy as the on-screen view. */
export function projectionNotes(data: ProjectionResult, t: TFunction): string[] {
  const method = data.isFuture
    ? t('salesProjection.methodFuture', { year: data.year, base: data.year - 1, growth: data.growthPct, low: money(data.fullYear.low), high: money(data.fullYear.high) })
    : data.seasonal
      ? t('salesProjection.methodSeasonal', { completed: data.completedMonths, year: data.year, prior: data.year - 1 })
      : t('salesProjection.methodFlat', { completed: data.completedMonths });
  const conf = { higher: t('salesProjection.confHigher'), moderate: t('salesProjection.confModerate'), lower: t('salesProjection.confLower') }[data.confidence];
  return [method, conf, t('salesProjection.disclaimer')];
}

/**
 * Sales projection as a real PDF (pdf-lib — no browser). Greyscale per the brand
 * kit; leads with the full-year number, the First-half / Back-half split and the
 * stated assumptions, so it can be handed to Home Depot as-is.
 */
export async function buildProjectionPdf(
  data: ProjectionResult,
  opts: { brandName: string; scopeLabel: string; generated: string; footer: string; notes: string[] },
): Promise<Uint8Array> {
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
  const ensure = (need: number) => {
    if (y - need < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const wrap = (s: string, maxW: number, size: number, f: PDFFont): string[] => {
    const words = s.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const planSuffix = data.isFuture ? '  (forward plan)' : data.isComplete ? '  (final)' : '';

  // Header
  text(opts.brandName.toUpperCase(), M, 11, bold, rgb(0.2, 0.2, 0.2));
  y -= 22;
  text(`Sales projection — ${data.year}${planSuffix}`, M, 20, bold, rgb(0.06, 0.06, 0.06));
  y -= 15;
  text([opts.scopeLabel, `Generated ${opts.generated}`].filter(Boolean).join('   ·   '), M, 9, font, MUTE);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2, color: SLATE });
  y -= 26;

  // Headline figure
  text(`Projected ${data.year} total`, M, 9, bold, MUTE);
  y -= 24;
  text(money(data.fullYear.expected), M, 26, bold, INK);
  y -= 16;
  if (data.isComplete) {
    text('Final — year complete.', M, 9, font, MUTE);
  } else {
    text(`Range ${money(data.fullYear.low)} – ${money(data.fullYear.high)}  (low / expected / high)`, M, 9.5, font, MUTE);
  }
  y -= 26;

  // Four tiles: H1 / H2 / (banked or growth) / run rate
  const tiles: [string, string][] = [
    ['First half (Jan–Jun)', `${money(data.firstHalf)}   ·   ~${data.firstHalfDeals} deals`],
    ['Back half (Jul–Dec)', `${money(data.backHalf)}   ·   ~${data.backHalfDeals} deals`],
    data.isFuture
      ? ['Growth assumption', `${data.growthPct >= 0 ? '+' : ''}${data.growthPct}%  on ${money(data.priorYearTotal)}`]
      : ['Banked so far', `${money(data.ytd)}   ·   ${data.ytdCount} deals`],
    ['Run rate / month', `${money(data.runRateMonthly)}   ·   ~${data.fullYearDeals} deals / yr`],
  ];
  for (const [label, value] of tiles) {
    ensure(26);
    text(label, M, 8.5, bold, SLATE);
    rightText(value, W - M, 11, font, INK);
    y -= 7;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.88, 0.9, 0.92) });
    y -= 15;
  }
  y -= 10;

  // Monthly table
  const colBanked = 360;
  const colProjected = 468;
  const colDeals = W - M;
  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: TINT });
    text('Month', M + 4, 8, bold, SLATE);
    rightText('Banked', colBanked, 8, bold, SLATE);
    rightText(data.isComplete ? 'Total' : 'Projected', colProjected, 8, bold, SLATE);
    rightText('Deals', colDeals, 8, bold, SLATE);
    y -= 20;
  };
  ensure(60);
  drawHeader();
  for (const m of data.months) {
    ensure(18);
    if (y === H - M) drawHeader();
    text(`${m.label} ${data.year}`, M + 4, 10, font);
    rightText(m.actual > 0 ? money(m.actual) : '—', colBanked, 10, font, m.actual > 0 ? INK : MUTE);
    rightText(money(m.projected), colProjected, 10, font, m.isProjected ? MUTE : INK);
    rightText(String(m.projectedCount), colDeals, 10, font, m.isProjected ? MUTE : INK);
    y -= 15;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.92) });
  }
  // Totals row
  ensure(20);
  text('Full year', M + 4, 10, bold);
  rightText(data.isFuture ? '—' : money(data.ytd), colBanked, 10, bold, data.isFuture ? MUTE : INK);
  rightText(money(data.fullYear.expected), colProjected, 10, bold);
  rightText(String(data.fullYearDeals), colDeals, 10, bold);
  y -= 24;

  // Assumptions / method
  ensure(30);
  text('How this is worked out', M, 9, bold, SLATE);
  y -= 16;
  for (const note of opts.notes) {
    for (const line of wrap(note, W - 2 * M, 9, font)) {
      ensure(13);
      text(line, M, 9, font, rgb(0.3, 0.3, 0.3));
      y -= 13;
    }
    y -= 4;
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(opts.footer, { x: M, y: 28, size: 8, font, color: MUTE });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 8), y: 28, size: 8, font, color: MUTE });
  });

  return doc.save();
}

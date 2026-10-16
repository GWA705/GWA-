import 'server-only';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { CONTENT_VERSION, type QuizQuestion } from './training';

// Pure-JS PDF generation (pdf-lib) so it runs in the production container, which
// has no Chromium. Two documents are produced for the completion email:
//   1) the rep's certificate of completion (branded, no score)
//   2) an answer review — every question with the correct answer, first-attempt
//      misses flagged — so they have the corrections "for the floor".

// ---- Brand palette ----
const ORANGE = rgb(0.976, 0.388, 0.008); // #f96302 Home Depot
const ORANGE_LT = rgb(0.976, 0.627, 0.42); // #f9a06b
const NAVY = rgb(0.118, 0.227, 0.541); // #1e3a8a GWA
const INK = rgb(0.059, 0.09, 0.165); // #0f172a
const SLATE700 = rgb(0.2, 0.255, 0.333); // #334155
const SLATE500 = rgb(0.392, 0.455, 0.545); // #64748b
const SLATE400 = rgb(0.58, 0.639, 0.722); // #94a3b8
const LINE = rgb(0.886, 0.91, 0.941); // #e2e8f0
const RED = rgb(0.725, 0.11, 0.11); // #b91c1c
const RED_BG = rgb(0.996, 0.949, 0.949); // #fef2f2
const RED_BD = rgb(0.984, 0.792, 0.792); // #fecaca
const GREEN = rgb(0.082, 0.502, 0.239); // #15803d
const GREEN_BG = rgb(0.863, 0.988, 0.906); // #dcfce7
const WHITE = rgb(1, 1, 1);

function publicPng(rel: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', rel));
  } catch {
    return null;
  }
}
async function embed(doc: PDFDocument, rel: string): Promise<PDFImage | null> {
  const bytes = publicPng(rel);
  if (!bytes) return null;
  try {
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

function centerText(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

/** Wrap text to a max pixel width, returning the lines. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface CertificatePdfParams {
  traineeName: string;
  office: string;
  startDate?: string | null;
  completedDate: string;
  signature: string;
  version?: string;
}

/** Landscape certificate of completion — branded, watermarked, no score. */
export async function certificatePdf(p: CertificatePdfParams): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]); // US Letter landscape
  const cx = 396;

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // Frame: orange outer, navy inner, thin orange hairline.
  page.drawRectangle({ x: 24, y: 24, width: 744, height: 564, borderColor: ORANGE, borderWidth: 6 });
  page.drawRectangle({ x: 32, y: 32, width: 728, height: 548, borderColor: NAVY, borderWidth: 2 });
  page.drawRectangle({ x: 37, y: 37, width: 718, height: 538, borderColor: ORANGE_LT, borderWidth: 1 });

  // Watermark (faint GWA icon), drawn before the content so text sits on top.
  const mark = await embed(doc, 'training/gwa-icon-mark.png');
  if (mark) {
    const mw = 300;
    const mh = (mark.height / mark.width) * mw;
    page.drawImage(mark, { x: cx - mw / 2, y: 300 - mh / 2, width: mw, height: mh, opacity: 0.06 });
  }

  // Co-branded logo — prominent at the top.
  const logo = await embed(doc, 'gwa-hd-partners.png');
  if (logo) {
    const lh = 92;
    const lw = (logo.width / logo.height) * lh;
    page.drawImage(logo, { x: cx - lw / 2, y: 452, width: lw, height: lh });
  }

  centerText(page, 'CERTIFICATE OF COMPLETION', cx, 432, 15, helvBold, NAVY);
  page.drawLine({ start: { x: cx - 60, y: 422 }, end: { x: cx + 60, y: 422 }, thickness: 2, color: NAVY });

  centerText(page, 'This certifies that', cx, 402, 13, helv, SLATE500);

  // Name — shrink to fit if long.
  let nameSize = 46;
  const name = (p.traineeName || '').trim() || '-';
  while (nameSize > 22 && timesBold.widthOfTextAtSize(name, nameSize) > 620) nameSize -= 2;
  centerText(page, name, cx, 352, nameSize, timesBold, INK);

  const program = 'has successfully completed the Home Depot in-store Lead Generator Training';
  centerText(page, program, cx, 320, 13, times, SLATE700);

  // Info row: Office · Start date · Completed.
  const cols: Array<{ label: string; value: string; cx: number }> = [
    { label: 'OFFICE', value: p.office || '—', cx: 228 },
    ...(p.startDate ? [{ label: 'START DATE', value: p.startDate, cx: 396 }] : []),
    { label: 'COMPLETED', value: p.completedDate, cx: p.startDate ? 564 : 480 },
  ];
  const rowY = 210;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    centerText(page, c.label, c.cx, rowY + 16, 9, helvBold, SLATE400);
    centerText(page, c.value, c.cx, rowY, 12, helvBold, INK);
    if (i > 0) page.drawLine({ start: { x: (cols[i - 1].cx + c.cx) / 2, y: rowY - 4 }, end: { x: (cols[i - 1].cx + c.cx) / 2, y: rowY + 26 }, thickness: 1, color: LINE });
  }

  // Signature.
  const sig = (p.signature || name).trim();
  centerText(page, sig, cx, 118, 24, timesItalic, INK);
  page.drawLine({ start: { x: cx - 150, y: 108 }, end: { x: cx + 150, y: 108 }, thickness: 1, color: LINE });
  centerText(page, 'Digitally signed  ·  Georgian Water & Air  ·  Authorized Home Depot Installer', cx, 92, 9, helv, SLATE400);
  centerText(page, `Program version ${p.version || CONTENT_VERSION}`, cx, 76, 8, helv, SLATE400);

  return Buffer.from(await doc.save());
}

export interface AnswerReviewPdfParams {
  traineeName: string;
  office: string;
  date: string;
  score: number; // first-attempt %
  passed: boolean;
  quiz: QuizQuestion[];
  firstAnswers: Record<string, number>;
  lang?: string;
}

/** Portrait answer-review — every question, correct answers, misses flagged. */
export async function answerReviewPdf(p: AnswerReviewPdfParams): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 612, H = 792, M = 48, CW = W - M * 2;
  const logo = await embed(doc, 'gwa-hd-partners.png');

  let page = doc.addPage([W, H]);
  const footer = (pg: PDFPage) => {
    pg.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: LINE });
    centerText(pg, 'Georgian Water & Air  ·  Authorized Home Depot Home Services Installer  ·  Keep this for your reference.', W / 2, 30, 8, helv, SLATE400);
  };

  // Header (first page) — prominent co-branded logo.
  if (logo) {
    const lh = 56;
    const lw = (logo.width / logo.height) * lh;
    page.drawImage(logo, { x: M, y: H - M - lh, width: lw, height: lh });
  }
  page.drawText('Training — Answer Review', { x: W - M - helvBold.widthOfTextAtSize('Training — Answer Review', 16), y: H - M - 16, size: 16, font: helvBold, color: INK });
  const subR = 'Lead Generator Training';
  page.drawText(subR, { x: W - M - helv.widthOfTextAtSize(subR, 10), y: H - M - 32, size: 10, font: helv, color: SLATE500 });
  page.drawLine({ start: { x: M, y: H - M - 62 }, end: { x: W - M, y: H - M - 62 }, thickness: 2, color: NAVY });

  const sub = `${p.traineeName}   ·   ${p.office}   ·   ${p.date}   ·   ${p.passed ? 'Passed' : 'Reviewed'} · ${p.score}% first try`;
  page.drawText(sub, { x: M, y: H - M - 82, size: 11, font: helvBold, color: SLATE700 });

  const intro = `Here are all ${p.quiz.length} questions with the correct answers. The ones flagged in red are the ones to review so you've got them for the floor.`;
  let y = H - M - 104;
  for (const line of wrapText(intro, helv, 10, CW)) {
    page.drawText(line, { x: M, y, size: 10, font: helv, color: SLATE500 });
    y -= 14;
  }
  y -= 10;

  const PAD = 12;
  for (let i = 0; i < p.quiz.length; i++) {
    const q = p.quiz[i];
    const picked = p.firstAnswers[q.id];
    const right = picked === q.correct;
    const qLines = wrapText(`${i + 1}. ${q.q}`, helvBold, 11, CW - PAD * 2);
    const yourText = typeof picked === 'number' ? q.options[picked] : '-';
    // Note: pdf-lib standard fonts use WinAnsi — avoid non-encodable glyphs
    // (checkmarks, em-dash). Colour + the red card convey right/wrong instead.
    const yourLines = wrapText(`${right ? 'Your answer:' : 'You picked:'}  ${yourText}`, helv, 10, CW - PAD * 2);
    const correctLines = right ? [] : wrapText(`Correct answer:  ${q.options[q.correct]}`, helv, 10, CW - PAD * 2);
    const cardH = PAD * 2 + qLines.length * 15 + 6 + yourLines.length * 14 + (correctLines.length ? 2 + correctLines.length * 14 : 0);

    if (y - cardH < 58) {
      footer(page);
      page = doc.addPage([W, H]);
      y = H - M;
    }

    const top = y;
    page.drawRectangle({ x: M, y: top - cardH, width: CW, height: cardH, color: right ? WHITE : RED_BG, borderColor: right ? LINE : RED_BD, borderWidth: 1 });
    let ty = top - PAD - 11;
    for (const line of qLines) {
      page.drawText(line, { x: M + PAD, y: ty, size: 11, font: helvBold, color: INK });
      ty -= 15;
    }
    ty -= 6;
    for (let li = 0; li < yourLines.length; li++) {
      page.drawText(yourLines[li], { x: M + PAD, y: ty, size: 10, font: helv, color: right ? GREEN : RED });
      ty -= 14;
    }
    if (correctLines.length) {
      ty -= 2;
      // highlight the correct-answer line
      const hlW = helv.widthOfTextAtSize(correctLines[0], 10) + 6;
      page.drawRectangle({ x: M + PAD - 3, y: ty - 3, width: Math.min(hlW, CW - PAD * 2 + 6), height: 14, color: GREEN_BG });
      for (const line of correctLines) {
        page.drawText(line, { x: M + PAD, y: ty, size: 10, font: helv, color: GREEN });
        ty -= 14;
      }
    }
    y = top - cardH - 10;
  }
  footer(page);

  return Buffer.from(await doc.save());
}

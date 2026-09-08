import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

export interface OrderPdfLine {
  quantity: number;
  itemName: string;
  option: string | null;
  partNumber: string | null;
}

export interface OrderPdfData {
  orderId: string;
  createdAt: Date;
  dealerName: string;
  /** Multi-line ship-to address (already newline-joined). */
  shipTo?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  submittedBy?: string | null;
  shippingMethod?: string | null;
  note?: string | null;
  lines: OrderPdfLine[];
}

const M = 54;
const RIGHT = 612 - M;
const TOP = 748;
const navy = rgb(0.055, 0.169, 0.361);
const gray = rgb(0.42, 0.45, 0.5);
const ink = rgb(0.1, 0.1, 0.12);
const line = rgb(0.9, 0.91, 0.93);

/**
 * Build a print-ready packing slip PDF for a marketplace order. It's attached to
 * the shipper's order email so they can print and pack straight from it — dealer
 * ship-to details, shipping method, and the item lines with per-size part
 * numbers. No prices (the marketplace carries none).
 */
export async function buildOrderPdf(data: OrderPdfData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([612, 792]);
  let y = TOP;

  const text = (s: string, x: number, size = 10, f: PDFFont = font, color = ink) =>
    page.drawText(s, { x, y, size, font: f, color });
  const right = (s: string, size = 10, f: PDFFont = font, color = ink) =>
    page.drawText(s, { x: RIGHT - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const rule = (thickness = 0.5, color = line) =>
    page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness, color });
  const clip = (s: string, size: number, f: PDFFont = font, max = RIGHT - M - 170) => {
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(`${out}…`, size) > max) out = out.slice(0, -1);
    return `${out}…`;
  };
  // Start a fresh continuation page and reset y to a headed position.
  const newPage = () => {
    page = pdf.addPage([612, 792]);
    y = TOP;
    text('Marketplace Order (continued)', M, 11, bold, navy);
    y -= 24;
  };

  // Header
  text('Georgian Water & Air', M, 17, bold, navy); y -= 18;
  text('Marketplace Order — Packing Slip', M, 11, font, gray); y -= 14;
  const printed = data.createdAt.toLocaleString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  text(`Order ${data.orderId.slice(-8).toUpperCase()}  ·  ${printed}`, M, 9, font, gray);
  y -= 12;
  rule(1.5, navy); y -= 22;

  // Ship-to block
  text('SHIP TO', M, 9, bold, gray); y -= 16;
  text(clip(data.dealerName, 12, bold), M, 12, bold); y -= 15;
  if (data.shipTo) {
    for (const addrLine of data.shipTo.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4)) {
      text(clip(addrLine, 10, font, RIGHT - M), M, 10); y -= 13;
    }
  } else {
    text('No address on file — confirm with the dealer.', M, 10, font, gray); y -= 13;
  }
  const contact: string[] = [];
  if (data.phone) contact.push(data.phone);
  if (data.altPhone) contact.push(data.altPhone);
  if (contact.length) { text(`Phone: ${contact.join('  /  ')}`, M, 10); y -= 13; }
  if (data.submittedBy) { text(`Ordered by: ${clip(data.submittedBy, 10, font, RIGHT - M)}`, M, 10, font, gray); y -= 13; }
  y -= 6;

  // Shipping method — highlighted so the shipper can't miss it
  text('SHIPPING METHOD', M, 9, bold, gray);
  text(data.shippingMethod || 'Not specified', M + 130, 11, bold, navy);
  y -= 20;
  rule(1, navy); y -= 20;

  // Item table
  const QTY_X = M;
  const NAME_X = M + 44;
  text('QTY', QTY_X, 9, bold, gray);
  text('ITEM', NAME_X, 9, bold, gray);
  right('PART #', 9, bold, gray);
  y -= 8;
  rule(); y -= 15;

  for (const l of data.lines) {
    if (y < 90) newPage();
    text(String(l.quantity), QTY_X, 11, bold);
    const label = l.option ? `${l.itemName} — ${l.option}` : l.itemName;
    text(clip(label, 10), NAME_X, 10);
    right(l.partNumber || '—', 10, l.partNumber ? bold : font, l.partNumber ? ink : gray);
    y -= 8;
    rule(); y -= 15;
  }

  const totalUnits = data.lines.reduce((s, l) => s + l.quantity, 0);
  y -= 4;
  if (y < 60) newPage();
  right(`Total pieces: ${totalUnits}`, 10, bold); y -= 22;

  if (data.note) {
    if (y < 80) newPage();
    text('NOTE', M, 9, bold, gray); y -= 15;
    let lineBuf = '';
    const flush = () => { if (lineBuf) { text(lineBuf, M, 10); y -= 13; lineBuf = ''; } };
    for (const w of data.note.split(/\s+/)) {
      const trial = lineBuf ? `${lineBuf} ${w}` : w;
      if (font.widthOfTextAtSize(trial, 10) > RIGHT - M) { flush(); lineBuf = w; }
      else lineBuf = trial;
      if (y < 70) { flush(); newPage(); }
    }
    flush();
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

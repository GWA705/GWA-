import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Pre-fill the Home Depot "Customer Signoff of Completion / Installer's Waiver
 * and Release of Lien" for one job, so the dealer downloads a filled form instead
 * of a blank one. The template (public/hd-customer-approval-waiver.pdf) is a flat
 * form — no AcroForm fields, 396×612pt (half-letter, origin bottom-left) — so we
 * stamp each value at coordinates measured from the template's own labels.
 *
 * We fill ONLY the known-from-the-deal fields: Store No., Customer Name, Job Site
 * Address, and the Installer's Company Name (the dealer/office). Signatures, the
 * completion dates, the permit # and the "dated ___" agreement line are left
 * blank — those are signed/dated by hand on-site. The legal release text is never
 * touched. Isomorphic (pdf-lib runs in Node); the caller reviews/prints the PDF.
 */

export interface HdWaiverData {
  storeNumber?: string | null;
  customerName?: string | null;
  jobSiteAddress?: string | null;
  /** The dealer/office business name → the "Installer's Company Name" line. */
  installerCompany?: string | null;
}

let _template: Uint8Array | null = null;
async function templateBytes(): Promise<Uint8Array> {
  if (!_template) {
    _template = await readFile(path.join(process.cwd(), 'public', 'hd-customer-approval-waiver.pdf'));
  }
  return _template;
}

/** Draw text, shrinking the font so it never runs past `maxWidth` (points). */
function drawFit(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, maxWidth: number) {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  page.drawText(text, { x, y, size: s, font, color: rgb(0.06, 0.06, 0.06) });
}

export async function fillHdWaiver(data: HdWaiverData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await templateBytes());
  const page = pdf.getPage(0);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const put = (text: string | null | undefined, x: number, y: number, maxWidth: number, size = 10) => {
    const t = (text ?? '').trim();
    if (t) drawFit(page, font, t, x, y, size, maxWidth);
  };

  // Coordinates in points (origin bottom-left). First pass — tuned by rendering.
  put(data.storeNumber, 66, 519, 60);           // "Store No." cell (left of the Permit divider)
  put(data.customerName, 88, 500, 300);         // right of "Customer Name"
  put(data.jobSiteAddress, 92, 480, 296);       // right of "Job Site Address"
  put(data.installerCompany, 24, 77, 338);      // the line above "Installer's Company Name"

  return pdf.save();
}

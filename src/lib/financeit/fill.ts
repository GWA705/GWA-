import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

/**
 * Fill the Financeit "Loan Application" PDF from entered form values. The template
 * (public/financeit-loan-application.pdf) is a flat form — no AcroForm fields — so
 * we stamp each value at coordinates derived from the template's own label
 * positions (Letter, 612×792, origin bottom-left; a value sits ~12pt under its
 * label's blank line). One page per borrower; a co-borrower gets a second copy
 * with "applying with <primary>" filled in.
 *
 * Isomorphic (pdf-lib runs in the browser and Node). The dealer reviews the
 * result before uploading.
 */

export interface BorrowerFields {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string; // yyyy-mm-dd
  homePhone?: string;
  mobilePhone?: string;
  maritalStatus?: string;
  email?: string;
  sin?: string;
  address?: string;
  unitNo?: string;
  monthlyHousingCost?: string;
  city?: string;
  province?: string;
  postal?: string;
  yearsAtAddress?: string;
  housingStatus?: string; // Own | Rent | Other
  idType?: string;
  idProvince?: string;
  idNumber?: string;
  idExpiry?: string; // yyyy-mm-dd
  businessName?: string;
  employerPhone?: string;
  positionTitle?: string;
  grossMonthlyIncome?: string;
  employerAddress?: string;
  timeAtJob?: string;
  employerCityProvince?: string;
}

// Value anchor (x, baseline y) for each field — placed on the dotted line to the
// RIGHT of its printed label, on the SAME baseline. Coordinates measured from the
// template's own text positions (Letter, 612×792, origin bottom-left): x is just
// past where each label ends, y is the label's baseline.
const MAP: Record<keyof BorrowerFields, { x: number; y: number }> = {
  firstName: { x: 116, y: 659 },
  lastName: { x: 399, y: 659 },
  middleName: { x: 125, y: 644 },
  dob: { x: 360, y: 644 },
  homePhone: { x: 122, y: 628 },
  maritalStatus: { x: 376, y: 628 },
  mobilePhone: { x: 130, y: 613 },
  email: { x: 345, y: 613 },
  sin: { x: 139, y: 598 },
  address: { x: 71, y: 558 },
  unitNo: { x: 289, y: 558 },
  monthlyHousingCost: { x: 411, y: 558 },
  city: { x: 55, y: 543 },
  province: { x: 254, y: 543 },
  postal: { x: 85, y: 528 },
  yearsAtAddress: { x: 289, y: 528 },
  housingStatus: { x: 0, y: 0 }, // handled specially (Own | Rent | Other row)
  idType: { x: 113, y: 301 },
  idProvince: { x: 391, y: 301 },
  idNumber: { x: 106, y: 285 },
  idExpiry: { x: 382, y: 285 },
  businessName: { x: 98, y: 246 },
  employerPhone: { x: 430, y: 246 },
  positionTitle: { x: 88, y: 231 },
  grossMonthlyIncome: { x: 409, y: 231 },
  employerAddress: { x: 108, y: 215 },
  timeAtJob: { x: 394, y: 215 },
  employerCityProvince: { x: 374, y: 200 },
};

// The chosen housing status is ringed with an ellipse over its word in the
// "Housing Status: Own | Rent | Other" row (baseline y≈543). {cx, cy} is centre.
const HOUSING_RING: Record<string, { cx: number; cy: number; rx: number }> = {
  own: { cx: 396, cy: 546, rx: 13 },
  rent: { cx: 427, cy: 546, rx: 13 },
  other: { cx: 459, cy: 546, rx: 15 },
};

function isoToUs(v?: string): string {
  const m = (v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : (v || '');
}

function drawBorrower(page: PDFPage, font: PDFFont, b: BorrowerFields) {
  const put = (key: keyof BorrowerFields, valueOverride?: string) => {
    const pos = MAP[key];
    if (!pos || (pos.x === 0 && pos.y === 0)) return;
    const raw = valueOverride ?? (b[key] as string | undefined);
    const val = (raw || '').toString().trim();
    if (!val) return;
    page.drawText(val.length > 60 ? val.slice(0, 60) : val, {
      x: pos.x,
      y: pos.y,
      size: 9,
      font,
      color: rgb(0.05, 0.05, 0.1),
    });
  };

  (Object.keys(MAP) as (keyof BorrowerFields)[]).forEach((k) => {
    if (k === 'housingStatus') return;
    if (k === 'dob') return put('dob', isoToUs(b.dob));
    if (k === 'idExpiry') return put('idExpiry', isoToUs(b.idExpiry));
    put(k);
  });

  // Housing status → an ellipse ring around the chosen option word.
  const hs = (b.housingStatus || '').toLowerCase();
  const ring = HOUSING_RING[hs.includes('own') ? 'own' : hs.includes('rent') ? 'rent' : hs.includes('other') ? 'other' : ''];
  if (ring) {
    page.drawEllipse({ x: ring.cx, y: ring.cy, xScale: ring.rx, yScale: 8, borderColor: rgb(0.05, 0.05, 0.1), borderWidth: 1.2 });
  }
}

/**
 * Return a filled Financeit PDF as bytes. `primary` is required; pass `co` to add
 * a second, co-borrower page that references the primary applicant.
 */
export async function fillFinanceitPdf(
  templateBytes: ArrayBuffer | Uint8Array,
  primary: BorrowerFields,
  co?: BorrowerFields | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page0 = doc.getPage(0);

  // If there's a co-borrower, copy the BLANK template page BEFORE we stamp the
  // primary onto page 0 — otherwise the copy carries the primary's text and the
  // co-borrower's values land on top of it.
  const hasCo = co && (co.firstName || co.lastName);
  const copied = hasCo ? (await doc.copyPages(doc, [0]))[0] : null;

  drawBorrower(page0, font, primary);

  if (hasCo && copied) {
    doc.addPage(copied);
    // "Co-borrower application. I am applying with ____ for joint credit." (baseline y≈701)
    const primaryName = `${primary.firstName ?? ''} ${primary.lastName ?? ''}`.trim();
    if (primaryName) copied.drawText(primaryName, { x: 213, y: 703, size: 9, font, color: rgb(0.05, 0.05, 0.1) });
    drawBorrower(copied, font, co as BorrowerFields);
  }

  return doc.save();
}

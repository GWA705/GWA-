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

// Value anchor (x, baseline y) for each field — placed on the blank under its
// printed label. Coordinates read from the template's text positions.
const MAP: Record<keyof BorrowerFields, { x: number; y: number }> = {
  firstName: { x: 35, y: 647 },
  lastName: { x: 319, y: 647 },
  middleName: { x: 35, y: 632 },
  dob: { x: 319, y: 632 },
  homePhone: { x: 35, y: 616 },
  maritalStatus: { x: 319, y: 616 },
  mobilePhone: { x: 35, y: 601 },
  email: { x: 319, y: 601 },
  sin: { x: 35, y: 586 },
  address: { x: 35, y: 546 },
  unitNo: { x: 253, y: 546 },
  monthlyHousingCost: { x: 319, y: 546 },
  city: { x: 35, y: 531 },
  province: { x: 216, y: 531 },
  postal: { x: 35, y: 516 },
  yearsAtAddress: { x: 191, y: 516 },
  housingStatus: { x: 0, y: 0 }, // handled specially (checkbox row)
  idType: { x: 35, y: 289 },
  idProvince: { x: 319, y: 289 },
  idNumber: { x: 35, y: 273 },
  idExpiry: { x: 319, y: 273 },
  businessName: { x: 35, y: 234 },
  employerPhone: { x: 319, y: 234 },
  positionTitle: { x: 35, y: 219 },
  grossMonthlyIncome: { x: 319, y: 219 },
  employerAddress: { x: 35, y: 203 },
  timeAtJob: { x: 319, y: 203 },
  employerCityProvince: { x: 319, y: 188 },
};

// "X" anchors for the Own | Rent | Other housing row (y≈543).
const HOUSING_MARK: Record<string, { x: number; y: number }> = {
  own: { x: 381, y: 543 },
  rent: { x: 405, y: 543 },
  other: { x: 434, y: 543 },
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

  // Housing status → an X over the chosen option.
  const hs = (b.housingStatus || '').toLowerCase();
  const mark = HOUSING_MARK[hs.includes('own') ? 'own' : hs.includes('rent') ? 'rent' : hs.includes('other') ? 'other' : ''];
  if (mark) page.drawText('X', { x: mark.x, y: mark.y, size: 9, font, color: rgb(0.05, 0.05, 0.1) });
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
  drawBorrower(page0, font, primary);

  const hasCo = co && (co.firstName || co.lastName);
  if (hasCo) {
    const [copied] = await doc.copyPages(doc, [0]);
    doc.addPage(copied);
    // "Co-borrower application. I am applying with ____ for joint credit." (y≈701)
    const primaryName = `${primary.firstName ?? ''} ${primary.lastName ?? ''}`.trim();
    if (primaryName) copied.drawText(primaryName, { x: 150, y: 703, size: 9, font, color: rgb(0.05, 0.05, 0.1) });
    drawBorrower(copied, font, co as BorrowerFields);
  }

  return doc.save();
}

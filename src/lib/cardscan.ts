/**
 * Credit-card-data detector (hard-block guard). Finds payment-card data in text
 * so it can be blocked BEFORE anything is stored — the portal must never hold
 * card numbers (that's what keeps PCI-DSS out of scope).
 *
 * Precision-first: a number only counts as a card if it passes the Luhn checksum
 * AND matches a known card prefix, so SINs, phone numbers, HD customer #s, loan
 * numbers, and void-cheque account/routing numbers don't trip it. This module is
 * pure and returns NO raw digits — only whether card data is present and which
 * signals fired (for an audit reason).
 */

export interface CardScanResult {
  blocked: boolean;
  /** Human-readable signals for the audit trail — never contains card digits. */
  signals: string[];
}

/** Luhn (mod-10) checksum used by all payment cards. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Which card brand a digit string looks like, or null. Length + prefix rules. */
export function cardBrand(digits: string): string | null {
  const n = digits.length;
  const p2 = Number(digits.slice(0, 2));
  const p3 = Number(digits.slice(0, 3));
  const p4 = Number(digits.slice(0, 4));

  if (digits[0] === '4' && (n === 13 || n === 16 || n === 19)) return 'Visa';
  if (n === 16 && ((p2 >= 51 && p2 <= 55) || (p4 >= 2221 && p4 <= 2720))) return 'Mastercard';
  if (n === 15 && (p2 === 34 || p2 === 37)) return 'Amex';
  if (n >= 16 && n <= 19 && (digits.startsWith('6011') || p2 === 65 || (p3 >= 644 && p3 <= 649))) return 'Discover';
  if (n === 14 && (p2 === 36 || p2 === 38 || (p3 >= 300 && p3 <= 305))) return 'Diners';
  if (n >= 16 && n <= 19 && p4 >= 3528 && p4 <= 3589) return 'JCB';
  return null;
}

// Specific cards GWA never accepts — always blocked by their leading digits,
// regardless of Luhn/context (robust even if OCR misreads the later digits).
const KNOWN_CARD_PREFIXES: { prefix: string; label: string }[] = [
  { prefix: '60352944', label: 'HD Card' }, // Home Depot Consumer Credit card
  { prefix: '43560121', label: 'FinanceIT Card' }, // FinanceIT one-time-use Visa prepaid
];

// Candidate: 13–19 digits with optional single spaces or dashes between them.
const CANDIDATE_RE = /\d(?:[ -]?\d){12,18}/g;

// A standalone North-American phone number (10 digits, optional leading 1, in
// 3-3-4 shape with the usual separators). The digit boundaries (?<!\d)/(?!\d)
// mean it only matches a self-contained 10-digit number — never a 10-digit slice
// inside a longer run — so a real 13–19 digit card number is left untouched.
// We blank these out before scanning so two phones written back-to-back (e.g.
// two 647-area-code numbers) can't merge into a 19-digit run that looks like a
// Discover card (its 644–649 prefix range overlaps the 647 area code).
const PHONE_RE = /(?<!\d)(?:\+?1[ .\-]?)?\(?\d{3}\)?[ .\-]?\d{3}[ .\-]?\d{4}(?!\d)/g;
const BRAND_WORD_RE = /\b(visa|mastercard|master\s?card|amex|american\s?express|discover)\b/i;
const EXPIRY_RE = /\b(0[1-9]|1[0-2])\s?[/\-]\s?(\d{2}|\d{4})\b/;
const CVV_CONTEXT_RE = /\b(cvv|cvc|cvv2|cvc2|security\s?code|card\s?verification)\b/i;

// "Strong" card indicators — two or more in a document, or one right beside the
// number, means it's card data even when the number isn't a major-brand BIN
// (e.g. store / private-label / finance cards like the HD consumer card).
const STRONG_CONTEXT: RegExp[] = [
  /credit\s*limit/i,
  /security\s*code|\bcvv2?\b|\bcvc2?\b/i,
  /\bapr\b|annual\s*percentage\s*rate/i,
  /card\s*holder|cardholder/i,
  /card\s*number/i,
  /scan\s*barcode\s*to\s*pay/i,
];
// Context that, when it sits right next to the number, ties it to a card.
const NEAR_CONTEXT_RE =
  /(credit\s*limit|account\s*number|card\s*number|security\s*code|\bcvv2?\b|\bcvc2?\b|\bapr\b|cardholder|card\s*holder|exp(?:iry|iration|\.)?)/i;

/**
 * Scan free text for payment-card data. `blocked` is true when a card number is
 * present, detected two ways:
 *   1. A Luhn-valid number matching a major-brand prefix (Visa/MC/Amex/…), or
 *   2. A Luhn-valid 13–19 digit number sitting in clear card context — a card
 *      keyword right beside it, or two+ strong card indicators in the document.
 * (2) catches store / private-label / finance cards whose BIN isn't a major
 * brand, while staying precise: a void cheque's short account number isn't a
 * 13–19 digit Luhn number, so it won't trip.
 */
export function findCardData(text: string): CardScanResult {
  const signals: string[] = [];
  if (!text) return { blocked: false, signals };

  const strongCount =
    STRONG_CONTEXT.filter((re) => re.test(text)).length + (BRAND_WORD_RE.test(text) ? 1 : 0);

  // Blank out phone numbers first (same-length spaces keep every index aligned
  // with `text`, so the context slices below still read the real surrounding
  // words). Card candidates are then found in the phone-free text.
  const scanText = text.replace(PHONE_RE, (m) => ' '.repeat(m.length));

  let pan = false;
  const brandsFound = new Set<string>();
  for (const m of scanText.matchAll(CANDIDATE_RE)) {
    const digits = m[0].replace(/[^\d]/g, '');
    if (digits.length < 13 || digits.length > 19) continue;

    // Specific cards GWA never accepts — blocked by prefix regardless of
    // Luhn/context, so they're caught even if OCR garbles the later digits.
    const known = KNOWN_CARD_PREFIXES.find((k) => digits.startsWith(k.prefix));
    if (known) {
      pan = true;
      brandsFound.add(known.label);
      continue;
    }

    if (!luhnValid(digits)) continue;

    const brand = cardBrand(digits);
    if (brand) {
      pan = true;
      brandsFound.add(brand);
      continue;
    }
    // Non-major-brand but Luhn-valid: block if it's clearly in card context.
    const idx = m.index ?? 0;
    const near = NEAR_CONTEXT_RE.test(text.slice(Math.max(0, idx - 80), idx + m[0].length + 80));
    if (near || strongCount >= 2) {
      pan = true;
      brandsFound.add('card');
    }
  }

  if (pan) signals.push(`pan:${[...brandsFound].join('/') || 'card'}`);
  if (BRAND_WORD_RE.test(text)) signals.push('brand-word');
  if (EXPIRY_RE.test(text)) signals.push('expiry');
  if (CVV_CONTEXT_RE.test(text)) signals.push('cvv-context');

  return { blocked: pan, signals };
}

/** Dealer-facing message shown when card data is blocked. */
export const CARD_BLOCK_MESSAGE =
  'The GWA Dealer Portal does not accept any Credit Card, HD Consumer Card, or FinanceIT one-time-use payment cards. Please call the GWA office at 705-812-0320 or 1-866-840-2789 during business hours, 11 am to 7:30 pm Monday to Friday, to approve credit card transactions.';

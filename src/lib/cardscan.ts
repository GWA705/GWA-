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

// Candidate: 13–19 digits with optional single spaces or dashes between them.
const CANDIDATE_RE = /\d(?:[ -]?\d){12,18}/g;
const BRAND_WORD_RE = /\b(visa|mastercard|master\s?card|amex|american\s?express|discover)\b/gi;
const EXPIRY_RE = /\b(0[1-9]|1[0-2])\s?[/\-]\s?(\d{2}|\d{4})\b/;
const CVV_CONTEXT_RE = /\b(cvv|cvc|cvv2|cvc2|security\s?code|card\s?verification)\b/i;

/**
 * Scan free text for payment-card data. `blocked` is true when a Luhn-valid PAN
 * with a known brand prefix is present (the hard-block trigger). Brand words,
 * expiry, and CVV context are recorded as corroborating signals only.
 */
export function findCardData(text: string): CardScanResult {
  const signals: string[] = [];
  if (!text) return { blocked: false, signals };

  let pan = false;
  const brandsFound = new Set<string>();
  for (const m of text.matchAll(CANDIDATE_RE)) {
    const digits = m[0].replace(/[^\d]/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    if (!luhnValid(digits)) continue;
    const brand = cardBrand(digits);
    if (brand) {
      pan = true;
      brandsFound.add(brand);
    }
  }

  if (pan) {
    signals.push(`pan:${[...brandsFound].join('/') || 'card'}`);
  }
  const words = text.match(BRAND_WORD_RE);
  if (words) signals.push('brand-word');
  if (EXPIRY_RE.test(text)) signals.push('expiry');
  if (CVV_CONTEXT_RE.test(text)) signals.push('cvv-context');

  // Hard block only on a real PAN. (Brand words / expiry / CVV alone are not
  // enough — they appear in legitimate, non-card contexts.)
  return { blocked: pan, signals };
}

/** Dealer-facing message shown when card data is blocked. */
export const CARD_BLOCK_MESSAGE =
  "For your customer's security, please remove credit card details before submitting — we never need a card number, expiry, or CVV. Cover or black them out and try again.";

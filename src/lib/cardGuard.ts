// Detects credit-card-like numbers so they can be kept OUT of chat (and any
// other free-text channel). Deliberately precise: it matches a 13–19 digit run
// (optionally split by single spaces or hyphens) that ALSO passes the Luhn
// check — so real card numbers are caught, but the portal's own reference
// numbers are not (HD Customer # ~9 digits, financing # ~7, phones 10–11).
//
// Pure module (no server-only imports) so the client can warn immediately and
// the server can enforce the same rule.

export function luhnValid(digits: string): boolean {
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** True if the text contains something that looks like a real card number. */
export function looksLikeCardNumber(text: string): boolean {
  const re = /\d(?:[ -]?\d){12,18}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return true;
  }
  return false;
}

// A shared, friendly message for when a card number is blocked.
export const CARD_BLOCK_MESSAGE =
  'For your security, please don’t send full card numbers in chat. Remove it and try again.';

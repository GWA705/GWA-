/**
 * Pure helpers for turning a sales-journal row into a linkable portal deal, used
 * when an HD Resolution reviewer finds a customer who was typed straight into the
 * journal and never became a real credit application.
 *
 * Kept dependency-free (no 'server-only', no googleapis, no prisma) so it can be
 * unit-tested and shared by the server action in journalCaseLink.ts. The server
 * side passes in the journal rows (ReportDeal from reporting/journalRead.ts, a
 * structural superset of JournalDealLike) and the resolved dealer id.
 */

/** The journal fields we need to match on and map from (subset of ReportDeal). */
export interface JournalDealLike {
  year: number;
  tab: string;
  rowNum: number;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  hdRef: string;
  hdStore: string;
  storeNumber: string | null;
  location: string;
  product: string;
  salesperson: string;
  isHD: boolean;
  result: 'OK' | 'PE/OK' | 'RB' | string;
  gross: number;
  netToGWA: number;
  date: Date | null;
  datePaid: Date | null;
  financeBucket: string;
  linkUrl: string;
}

/** Stable key identifying one journal row across a request round-trip. */
export function journalMatchKey(d: Pick<JournalDealLike, 'year' | 'tab' | 'rowNum'>): string {
  return `${d.year}::${d.tab}::${d.rowNum}`;
}

/** Parse a key back to its parts, or null if malformed. */
export function parseJournalMatchKey(key: string): { year: number; tab: string; rowNum: number } | null {
  const parts = String(key || '').split('::');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const rowNum = parseInt(parts[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(rowNum) || !parts[1]) return null;
  return { year, tab: parts[1], rowNum };
}

/** Normalize a free-text query into search name tokens (≥2 letters, non-numeric). */
export function queryNameTokens(source: string): string[] {
  return String(source || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t))
    .map((t) => t.toLowerCase());
}

/** Last 10 digits of a phone-ish string, or '' if fewer than 7 digits. */
export function phoneLast10(source: string): string {
  const digits = String(source || '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : '';
}

/**
 * Does this journal row match the search? A row matches when EITHER the phone
 * (last-10) matches, OR every name token hits the first or last name. Mirrors
 * the deal-search logic in the resolutions actions so both feel consistent.
 */
export function journalDealMatches(
  d: JournalDealLike,
  tokens: string[],
  last10: string,
): boolean {
  if (last10) {
    const rowDigits = String(d.phone || '').replace(/\D/g, '');
    if (rowDigits.length >= 10 && rowDigits.slice(-10) === last10) return true;
  }
  if (tokens.length) {
    const name = `${d.firstName} ${d.lastName}`.toLowerCase();
    if (tokens.every((t) => name.includes(t))) return true;
  }
  return false;
}

export type ProgramCategory = 'WATER' | 'AIR' | 'SMELL_BUSTERS' | 'HVAC';

/**
 * Best-effort program category from the free-text product cell. Water treatment
 * is the core business, so default WATER; nudge to AIR/HVAC only on clear signals.
 */
export function inferProgramCategory(product: string): ProgramCategory {
  const p = String(product || '').toLowerCase();
  if (/\bhvac\b|furnace|heat pump|air condition|\bac\b|a\/c/.test(p)) return 'HVAC';
  if (/smell.?buster/.test(p)) return 'SMELL_BUSTERS';
  if (/air\b|purifier|air\s?treatment/.test(p)) return 'AIR';
  return 'WATER';
}

export type PaymentMethod =
  | 'FINANCEIT'
  | 'FINANCE_COMPANY'
  | 'CASH'
  | 'CHEQUE'
  | 'E_TRANSFER'
  | 'CREDIT_CARD'
  | 'HD_CREDIT_CARD';

/**
 * Map the journal's normalized finance bucket to a PaymentMethod enum where it's
 * unambiguous; null when it isn't (the raw bucket is always kept in the note).
 */
export function paymentMethodFromBucket(bucket: string): PaymentMethod | null {
  switch (String(bucket || '').trim()) {
    case 'HDFINIT':
    case 'GHSFINIT':
      return 'FINANCEIT';
    case 'HDCC':
      return 'HD_CREDIT_CARD';
    case 'Credit Card':
      return 'CREDIT_CARD';
    case 'Cash/Cheque/Etransfer':
      return 'CASH';
    case 'HDUEI':
    case 'GoodHome':
    case 'Enercare':
    case 'Project Loan':
      return 'FINANCE_COMPANY';
    default:
      return null; // Unknown / Other — leave unset
  }
}

/** Split the free-text product cell into a tidy productsSold array. */
export function splitProducts(product: string): string[] {
  return String(product || '')
    .split(/[,;+/]|\band\b|&/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 12);
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function fmtDay(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A human-readable summary of the journal row for the case note / activity log,
 * so the reviewer sees everything the journal held (including the fields the Deal
 * & financing card doesn't surface: salesperson, finance bucket, net, paid date).
 */
export function journalDealNote(d: JournalDealLike): string {
  const name = `${d.firstName} ${d.lastName}`.trim() || 'customer';
  const lines = [
    `Created and linked a deal from the ${d.year} sales journal (${d.tab}, row ${d.rowNum}) for ${name}.`,
    '',
    `• Program: ${d.isHD ? 'Home Depot' : 'GWA'}${d.hdRef ? ` · HD Ref ${d.hdRef}` : ''}${d.hdStore ? ` · Store ${d.hdStore}` : ''}`,
    `• Product: ${d.product || '—'}`,
    `• Salesperson: ${d.salesperson || '—'}`,
    `• Sale date: ${fmtDay(d.date)} · Paid: ${fmtDay(d.datePaid)} · Result: ${d.result || '—'}`,
    `• Financing: ${d.financeBucket || '—'}`,
    `• Gross: ${fmtMoney(d.gross)} · Net to GWA: ${fmtMoney(d.netToGWA)}`,
  ];
  if (d.address) lines.push(`• Address: ${d.address}`);
  if (d.phone) lines.push(`• Phone: ${d.phone}`);
  if (d.linkUrl) lines.push('', `Journal row: ${d.linkUrl}`);
  return lines.join('\n');
}

/** Short one-line label for the candidate list in the link panel. */
export function journalDealLabel(d: JournalDealLike): string {
  const bits = [
    d.isHD ? 'HD' : 'GWA',
    d.hdRef ? `#${d.hdRef}` : '',
    d.product || '',
    fmtDay(d.date),
    fmtMoney(d.gross),
  ].filter(Boolean);
  return bits.join(' · ');
}

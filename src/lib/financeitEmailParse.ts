/**
 * Pure parsing of FinanceIt's deal-notification emails — no server or Gmail
 * dependencies, so it can be unit-tested on its own (see tests/financeitEmail.test.ts).
 * The Gmail fetching + deal-matching lives in financeitEmail.ts and builds on this.
 */

export const FINANCEIT_FROM = 'partners@financeit.io';

/** Which point in the loan's life an email represents (from its subject). */
export type FinanceitLifecycle =
  | 'PRE_QUALIFIED' // application approved — the richest email (all fields)
  | 'CONDITIONS_CLEARED'
  | 'READY_TO_FUND'
  | 'AUTHORIZED' // customer authorized the release of funds
  | 'CARD_DETAILS'
  | 'FINALIZED' // funded & finalized
  | 'DECLINED' // soft decline / affordability / needs co-borrower
  | 'OTHER';

export interface FinanceitEmailData {
  gmailMessageId: string;
  subject: string;
  sentAt: Date | null;
  lifecycle: FinanceitLifecycle;
  // Parsed fields (any may be null — different email types carry different sets).
  loanNumber: string | null;
  customerName: string | null;
  phone: string | null; // digits only
  email: string | null;
  applicationSource: string | null;
  employee: string | null; // the selling salesperson
  purchaseAmount: number | null;
  purchaseType: string | null;
  creditLimit: number | null;
  program: string | null; // e.g. "8.99% Interest for 60 Months"
  apr: string | null;
  monthlyPayment: number | null;
  termMonths: number | null; // parsed out of the program line
  expiryDate: Date | null;
}

export function digitsOnly(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\D/g, '');
  return d || null;
}

/** Last 10 digits of a phone, for matching regardless of formatting / country code. */
export function last10(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  return d && d.length >= 10 ? d.slice(-10) : d;
}

/** "$1,234.56" → 1234.56 ; blank/garbage → null. */
function parseMoney(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "8.99% Interest for 60 Months" → 60. */
function parseTermMonths(program: string | null): number | null {
  if (!program) return null;
  const m = /(\d{1,3})\s*month/i.exec(program);
  return m ? Number(m[1]) : null;
}

function parseDate(v: string): Date | null {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

export function lifecycleFromSubject(subject: string): FinanceitLifecycle {
  const s = (subject || '').toLowerCase();
  if (/finalized/.test(s)) return 'FINALIZED';
  if (/pre-qualified|pre‑qualified|prequalified/.test(s)) return 'PRE_QUALIFIED';
  if (/approval conditions cleared/.test(s)) return 'CONDITIONS_CLEARED';
  if (/authorized the release/.test(s)) return 'AUTHORIZED';
  if (/ready to request funds/.test(s)) return 'READY_TO_FUND';
  if (/payment card details/.test(s)) return 'CARD_DETAILS';
  if (/did not qualify|affordability|try to get|declined|co-?borrower/.test(s)) return 'DECLINED';
  return 'OTHER';
}

/**
 * Turn a FinanceIt email body into a field map. The body is a flat list of
 * "Label: value" lines separated by blank lines; the colon may or may not be
 * followed by a space ("Monthly payment amount:$34.34"). First occurrence of a
 * label wins, so the footer's "Email:" never clobbers "Email address:".
 */
function labelMap(body: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = /^\s*([A-Za-z][A-Za-z /]+?)\s*:\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    if (!(key in map)) map[key] = m[2].trim();
  }
  return map;
}

export function parseFinanceitEmail(
  gmailMessageId: string,
  subject: string,
  sentAt: Date | null,
  body: string,
): FinanceitEmailData {
  const map = labelMap(body);
  const program = map['program'] || null;
  return {
    gmailMessageId,
    subject,
    sentAt,
    lifecycle: lifecycleFromSubject(subject),
    loanNumber: digitsOnly(map['loan number']),
    customerName: map['customer name'] || null,
    phone: digitsOnly(map['phone number']),
    email: map['email address'] || null,
    applicationSource: map['application source'] || null,
    employee: map['employee'] || null,
    purchaseAmount: parseMoney(map['purchase amount']),
    purchaseType: map['purchase type'] || null,
    creditLimit: parseMoney(map['credit limit']),
    program,
    apr: map['apr'] || null,
    monthlyPayment: parseMoney(map['monthly payment amount']),
    termMonths: parseTermMonths(program),
    expiryDate: map['expiry date'] ? parseDate(map['expiry date']) : null,
  };
}

/** How many useful fields a parsed email carries — used to pick the richest. */
export function fieldScore(d: FinanceitEmailData): number {
  const fields = [
    d.loanNumber, d.phone, d.email, d.purchaseAmount, d.purchaseType,
    d.creditLimit, d.program, d.monthlyPayment, d.termMonths, d.employee,
    d.applicationSource, d.expiryDate,
  ];
  return fields.filter((v) => v !== null && v !== undefined).length;
}

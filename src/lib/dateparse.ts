// Flexible date parsing for scanned documents. OCR'd forms print dates every
// which way — 03/12/1990, 03.12.90, 1990-03-12, "March 12, 1990" — and a bare
// numeric date like 03/12 is genuinely ambiguous (Mar 12 vs Dec 3). This parser
// accepts all the common shapes and, crucially, reports when it had to GUESS the
// month/day order, so the UI can flag that field for the user to double-check.

export interface FlexibleDate {
  /** Normalized YYYY-MM-DD, or null if nothing date-like was found. */
  iso: string | null;
  /** True when day/month order (or a 2-digit year) had to be guessed. */
  ambiguous: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 2-digit year → 4-digit. 00–69 → 2000s, 70–99 → 1900s (the usual window).
function expandYear(raw: string): { year: number; guessed: boolean } {
  if (raw.length === 4) return { year: Number(raw), guessed: false };
  const n = Number(raw);
  return { year: n < 70 ? 2000 + n : 1900 + n, guessed: true };
}

/**
 * Parse a loose date string. `preferDMY` swaps the default guess to day/month
 * order for ambiguous all-numeric dates (North-American forms are month-first,
 * so the default is false).
 */
export function parseFlexibleDate(raw: string, opts: { preferDMY?: boolean } = {}): FlexibleDate {
  const s = (raw || '').trim();
  if (!s) return { iso: null, ambiguous: false };

  // Written month: "March 12, 1990", "12 Mar 1990", "Mar. 12 1990".
  const monthName = s.match(/[A-Za-z]{3,}/);
  if (monthName) {
    const mo = MONTHS[monthName[0].slice(0, 3).toLowerCase()];
    const nums = s.match(/\d{1,4}/g) ?? [];
    if (mo && nums.length >= 2) {
      // The 4-digit (or larger) number is the year; the other is the day.
      const year = nums.find((n) => n.length === 4);
      const day = nums.find((n) => n !== year && Number(n) <= 31);
      if (year && day && valid(Number(year), mo, Number(day))) {
        return { iso: iso(Number(year), mo, Number(day)), ambiguous: false };
      }
    }
    return { iso: null, ambiguous: false };
  }

  // All-numeric with separators / . -
  const parts = s.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
  if (!parts) return { iso: null, ambiguous: false };
  const [, a, b, c] = parts;

  // Year-first (YYYY-MM-DD and friends): unambiguous.
  if (a.length === 4) {
    const y = Number(a);
    const m = Number(b);
    const d = Number(c);
    if (valid(y, m, d)) return { iso: iso(y, m, d), ambiguous: false };
    return { iso: null, ambiguous: false };
  }

  // Year-last. Expand a 2-digit year (a guess in itself).
  const { year, guessed: yearGuessed } = expandYear(c);
  const x = Number(a);
  const z = Number(b);

  // If exactly one of the first two is > 12, it must be the day → order is known.
  let month: number;
  let day: number;
  let orderGuessed = false;
  if (x > 12 && z <= 12) {
    day = x;
    month = z;
  } else if (z > 12 && x <= 12) {
    month = x;
    day = z;
  } else {
    // Both ≤ 12 (or both > 12, which is invalid): guess by locale preference.
    orderGuessed = x !== z; // if they're equal (e.g. 05/05) the order doesn't matter
    if (opts.preferDMY) {
      day = x;
      month = z;
    } else {
      month = x;
      day = z;
    }
  }

  if (!valid(year, month, day)) return { iso: null, ambiguous: false };
  return { iso: iso(year, month, day), ambiguous: yearGuessed || orderGuessed };
}

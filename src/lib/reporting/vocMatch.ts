import JSZip from 'jszip';
import { repKey } from './salespersonLeaderboard';

/**
 * Voice of the Customer (VOC) matching — PURE logic (no DB / no network), so it
 * can be unit-tested and reused server-side.
 *
 * Home Depot runs the VOC program: after an install, HD surveys the customer and
 * records the review under a Lead # (an 800…/701… reference). We tie each VOC to
 * one of our deals by matching that Lead # to the sales journal's "HD Ref #",
 * which then tells us the OFFICE and the SALES REP who earned it.
 *
 * Office attribution is store-number based (reliable, no journal needed); rep
 * attribution needs a journal match (best-effort — the match rate is surfaced).
 */

export interface ParsedVocRow {
  leadRef: string;
  storeName: string | null;
  storeNumber: string | null;
  district: string | null;
  submissionDate: string | null; // ISO 'YYYY-MM-DD' or null
  reviewText: string | null;
  overallRating: number | null;
  ivoc: number | null;
  ltsa: number | null;
  knowledgeable: number | null;
  timely: number | null;
  workmanship: number | null;
  communication: number | null;
  installerCare: number | null;
  installerFriendliness: number | null;
}

/** Digits-only key for joining a VOC Lead # to a journal HD Ref #. */
export function normalizeRef(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Pull the 4-digit HD store number out of a store label like "WINDSOR-7228". */
export function storeNumberOf(raw: unknown): string | null {
  const m = String(raw ?? '').match(/(\d{4})/);
  return m ? m[1] : null;
}

// --- xlsx parsing (jszip; the file is a zip of XML) -------------------------

function xmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function colIndex(ref: string): number {
  const m = ref.match(/^([A-Z]+)/);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** "M/D/YYYY" (the HD export's format) → ISO 'YYYY-MM-DD', else null. */
function toIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    let year = parseInt(yy, 10);
    if (year < 100) year += 2000;
    const iso = `${year}-${String(+mm).padStart(2, '0')}-${String(+dd).padStart(2, '0')}`;
    return Number.isNaN(new Date(iso).getTime()) ? null : iso;
  }
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toInt(raw: string | null): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseInt(String(raw).replace(/[^0-9.\-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

const HEADER_KEYS: { field: keyof ParsedVocRow; needles: string[] }[] = [
  { field: 'district', needles: ['district'] },
  { field: 'storeName', needles: ['store'] },
  { field: 'submissionDate', needles: ['submission date', 'date'] },
  { field: 'leadRef', needles: ['lead'] },
  { field: 'reviewText', needles: ['review'] },
  { field: 'overallRating', needles: ['overall'] },
  { field: 'ivoc', needles: ['ivoc'] },
  { field: 'ltsa', needles: ['ltsa'] },
  { field: 'knowledgeable', needles: ['knowledge'] },
  { field: 'timely', needles: ['timely'] },
  { field: 'workmanship', needles: ['workmanship'] },
  { field: 'communication', needles: ['communication'] },
  { field: 'installerCare', needles: ['installer care'] },
  { field: 'installerFriendliness', needles: ['friendl'] },
];

/**
 * Parse a Home Depot VOC export (.xlsx buffer) into rows. Tolerant of the
 * District/Store columns being "merged" (blank on continuation rows) — those are
 * forward-filled. Only rows with a Lead # are returned.
 */
export async function parseVocBuffer(buf: Buffer | Uint8Array): Promise<{ rows: ParsedVocRow[]; error?: string }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return { rows: [], error: 'That file could not be opened as an Excel (.xlsx) workbook.' };
  }
  const ssXml = (await zip.file('xl/sharedStrings.xml')?.async('string')) || '';
  const shared: string[] = [];
  for (const si of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const t of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
    shared.push(xmlDecode(text));
  }

  const sheetPath = Object.keys(zip.files).find((f) => /xl\/worksheets\/sheet1\.xml$/.test(f));
  if (!sheetPath) return { rows: [], error: 'The workbook has no worksheet.' };
  const xml = await zip.file(sheetPath)!.async('string');

  const grid: (string | null)[][] = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: (string | null)[] = [];
    for (const cm of rm[1].matchAll(/<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const idx = colIndex(cm[1]);
      const attrs = cm[2];
      const body = cm[3];
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val: string | null = null;
      if (t === 's') val = shared[parseInt(v ?? '-1', 10)] ?? null;
      else if (t === 'inlineStr') val = xmlDecode((body.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
      else if (v != null) val = xmlDecode(v);
      cells[idx] = val;
    }
    grid.push(cells);
  }
  if (grid.length < 2) return { rows: [], error: 'The workbook has no data rows.' };

  const header = grid[0].map((c) => String(c ?? '').trim().toLowerCase());
  const col: Partial<Record<keyof ParsedVocRow, number>> = {};
  for (const { field, needles } of HEADER_KEYS) {
    for (const needle of needles) {
      const i = header.findIndex((h) => h.includes(needle));
      if (i !== -1) {
        col[field] = i;
        break;
      }
    }
  }
  if (col.leadRef == null) return { rows: [], error: 'Could not find a "Lead #" column in the file.' };

  const get = (row: (string | null)[], f: keyof ParsedVocRow): string | null => {
    const i = col[f];
    return i == null ? null : (row[i] ?? null);
  };

  const rows: ParsedVocRow[] = [];
  let fillDistrict: string | null = null;
  let fillStore: string | null = null;
  for (let r = 1; r < grid.length; r += 1) {
    const row = grid[r] || [];
    const dist = get(row, 'district');
    const store = get(row, 'storeName');
    if (dist) fillDistrict = dist;
    if (store) fillStore = store;
    const leadRaw = get(row, 'leadRef');
    if (!leadRaw || !String(leadRaw).trim()) continue; // skip blank/continuation-only rows
    const storeName = store || fillStore;
    rows.push({
      leadRef: String(leadRaw).trim(),
      storeName,
      storeNumber: storeNumberOf(storeName),
      district: dist || fillDistrict,
      submissionDate: toIsoDate(get(row, 'submissionDate')),
      reviewText: get(row, 'reviewText'),
      overallRating: toInt(get(row, 'overallRating')),
      ivoc: toInt(get(row, 'ivoc')),
      ltsa: toInt(get(row, 'ltsa')),
      knowledgeable: toInt(get(row, 'knowledgeable')),
      timely: toInt(get(row, 'timely')),
      workmanship: toInt(get(row, 'workmanship')),
      communication: toInt(get(row, 'communication')),
      installerCare: toInt(get(row, 'installerCare')),
      installerFriendliness: toInt(get(row, 'installerFriendliness')),
    });
  }
  return { rows };
}

// --- breakdown by office & rep (pure) --------------------------------------

export interface VocRepCount {
  rep: string; // display name (most common spelling), or the unknown-bucket label
  count: number;
  matched: boolean; // false only for the "rep not found" bucket
}

export interface VocOfficeBreakdown {
  dealerId: string | null; // null = VOCs whose store didn't map to any office
  office: string;
  total: number;
  matchedToRep: number;
  reps: VocRepCount[]; // sorted desc; the unknown bucket (if any) sorts last
  avgOverall: number | null;
}

export interface VocBreakdown {
  totalVocs: number;
  matchedToRep: number;
  matchRatePct: number;
  offices: VocOfficeBreakdown[]; // sorted by total desc
}

export const REP_UNKNOWN = 'Rep not found in journal';

interface VocInput {
  leadRef: string;
  storeNumber: string | null;
  overallRating: number | null;
}
interface DealInput {
  hdRef: string;
  storeNumber: string | null;
  salesperson: string;
}
interface OfficeInput {
  dealerId: string;
  name: string;
  storeNumbers: string[];
}

/**
 * Group VOCs by office and, within each office, by sales rep.
 *  - Office: the VOC's own store number → the office that owns that store; if the
 *    store isn't known, fall back to the matched deal's store; else "Unassigned".
 *  - Rep: the matched journal deal's salesperson (near-duplicate names merged via
 *    repKey), or the "rep not found" bucket when there's no journal match.
 *
 * Pass `restrictDealerIds` to keep only those offices (the dealer-scoped view);
 * the Unassigned bucket is dropped in that case.
 */
export function buildVocBreakdown(
  input: { vocs: VocInput[]; deals: DealInput[]; offices: OfficeInput[] },
  opts: { restrictDealerIds?: string[] } = {},
): VocBreakdown {
  // ref → deal (prefer a deal that actually names a rep)
  const refToDeal = new Map<string, DealInput>();
  for (const d of input.deals) {
    const key = normalizeRef(d.hdRef);
    if (key.length < 6) continue;
    const existing = refToDeal.get(key);
    if (!existing || (!existing.salesperson.trim() && d.salesperson.trim())) refToDeal.set(key, d);
  }
  // storeNumber → office
  const storeToOffice = new Map<string, OfficeInput>();
  for (const o of input.offices) for (const s of o.storeNumbers) storeToOffice.set(String(s).trim(), o);

  interface Acc {
    dealerId: string | null;
    office: string;
    total: number;
    matched: number;
    ratingSum: number;
    ratingN: number;
    reps: Map<string, { display: Map<string, number>; count: number; matched: boolean }>;
  }
  const byOffice = new Map<string, Acc>();
  const accFor = (dealerId: string | null, office: string): Acc => {
    const k = dealerId ?? `__un__:${office}`;
    let a = byOffice.get(k);
    if (!a) {
      a = { dealerId, office, total: 0, matched: 0, ratingSum: 0, ratingN: 0, reps: new Map() };
      byOffice.set(k, a);
    }
    return a;
  };

  let totalMatched = 0;
  for (const v of input.vocs) {
    const deal = refToDeal.get(normalizeRef(v.leadRef));
    const office =
      (v.storeNumber && storeToOffice.get(v.storeNumber)) ||
      (deal?.storeNumber ? storeToOffice.get(deal.storeNumber) : undefined) ||
      null;
    const dealerId = office?.dealerId ?? null;
    const officeName = office?.name ?? 'Unassigned';
    const acc = accFor(dealerId, officeName);
    acc.total += 1;
    if (v.overallRating != null) {
      acc.ratingSum += v.overallRating;
      acc.ratingN += 1;
    }
    const repRaw = deal?.salesperson?.trim() || '';
    const hasRep = repRaw.length > 0;
    if (hasRep) {
      acc.matched += 1;
      totalMatched += 1;
      const key = repKey(repRaw);
      let r = acc.reps.get(key);
      if (!r) {
        r = { display: new Map(), count: 0, matched: true };
        acc.reps.set(key, r);
      }
      r.count += 1;
      r.display.set(repRaw, (r.display.get(repRaw) ?? 0) + 1);
    } else {
      const key = `__unknown__`;
      let r = acc.reps.get(key);
      if (!r) {
        r = { display: new Map([[REP_UNKNOWN, 1]]), count: 0, matched: false };
        acc.reps.set(key, r);
      }
      r.count += 1;
    }
  }

  const restrict = opts.restrictDealerIds ? new Set(opts.restrictDealerIds) : null;
  const offices: VocOfficeBreakdown[] = [];
  for (const a of byOffice.values()) {
    if (restrict && (a.dealerId == null || !restrict.has(a.dealerId))) continue;
    const reps: VocRepCount[] = [...a.reps.values()].map((r) => {
      // display = most common original spelling
      let best = REP_UNKNOWN;
      let bestN = -1;
      for (const [name, n] of r.display) if (n > bestN) ((best = name), (bestN = n));
      return { rep: best, count: r.count, matched: r.matched };
    });
    reps.sort((x, y) => (x.matched === y.matched ? y.count - x.count : x.matched ? -1 : 1));
    offices.push({
      dealerId: a.dealerId,
      office: a.office,
      total: a.total,
      matchedToRep: a.matched,
      reps,
      avgOverall: a.ratingN ? Math.round((a.ratingSum / a.ratingN) * 100) / 100 : null,
    });
  }
  offices.sort((x, y) => y.total - x.total || x.office.localeCompare(y.office));

  const totalVocs = restrict
    ? offices.reduce((s, o) => s + o.total, 0)
    : input.vocs.length;
  const matched = restrict ? offices.reduce((s, o) => s + o.matchedToRep, 0) : totalMatched;
  return {
    totalVocs,
    matchedToRep: matched,
    matchRatePct: totalVocs ? Math.round((matched / totalVocs) * 100) : 0,
    offices,
  };
}

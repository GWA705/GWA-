import 'server-only';
import { readJournal, EARLIEST_JOURNAL_YEAR } from './journalRead';
import { loadDealerMatchIndex } from './dealerMatch';
import { listReportOffices } from './monthly';
import { loadStoreCanon, type StoreCanon } from './storeCanon';

/**
 * "Store ↔ Dealer" report — the cross-reference between Home Depot stores and the
 * offices (dealers) that sold at them, read straight from the sales journals.
 *
 * Two lenses over one matrix:
 *   • By store  — pick a store (Barrie, Orillia, …) and see EACH office that sold
 *                 there, with its deals, dollars and the date span it was active.
 *                 This is also the store "handover timeline": a store that moved
 *                 from one office to another shows both, each with its own span.
 *   • By dealer — pick an office (e.g. Home Service Providers) and see every store
 *                 it sold at, with the same per-store numbers.
 *
 * Attribution is by the journal's Dealer column (store number only as a fallback
 * for a blank/ambiguous label) — the same rule the office reports now use — so a
 * store shared by several offices is split correctly between them.
 *
 * Money basis = SOLD gross (OK + PE/OK active deals, by SALE date) because this
 * report is about who was SELLING where and when. Paid-OK gross is also carried
 * so the dollars reconcile with the office reports when needed.
 */

export interface StoreDealerStat {
  dealerId: string; // '' for the unmatched bucket
  dealerName: string;
  archived: boolean;
  deals: number;
  gross: number; // sold gross (OK + PE/OK)
  paidGross: number; // OK, by date paid
  units: number;
  firstSale: Date | null;
  lastSale: Date | null;
}

export interface StoreGroup {
  storeNumber: string;
  storeLabel: string; // "7024 — Barrie"
  storeName: string; // "Barrie"
  dealers: StoreDealerStat[]; // offices that sold here, most-recently-active first
  totalDeals: number;
  totalGross: number;
}

export interface DealerStoreStat {
  storeNumber: string;
  storeLabel: string;
  storeName: string;
  deals: number;
  gross: number;
  paidGross: number;
  units: number;
  firstSale: Date | null;
  lastSale: Date | null;
}

export interface DealerGroup {
  dealerId: string;
  dealerName: string;
  archived: boolean;
  stores: DealerStoreStat[]; // stores this office sold at, biggest dollars first
  totalDeals: number;
  totalGross: number;
}

export interface StoreDealerReport {
  mode: 'store' | 'dealer';
  // Picker options.
  stores: { number: string; label: string }[];
  dealers: { id: string; name: string; archived: boolean }[];
  // Selected-view payloads (exactly one is set once a selection is made).
  storeGroup: StoreGroup | null; // mode=store + a store chosen
  dealerGroup: DealerGroup | null; // mode=dealer + a dealer chosen
  allStores: StoreGroup[]; // mode=store + nothing chosen → every store (handover overview)
  yearsRead: number[];
  configured: boolean;
  error?: string;
}

interface Cell {
  storeNumber: string;
  dealerId: string; // '' = unmatched
  dealerName: string;
  archived: boolean;
  deals: number;
  gross: number;
  paidGross: number;
  units: number;
  firstSale: Date | null;
  lastSale: Date | null;
}

function minDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

interface Matrix {
  cells: Map<string, Cell>; // key `${store}||${dealerId}`
  canon: StoreCanon; // canonical store numbers + names (rolls up mistyped numbers)
  dealers: Map<string, { name: string; archived: boolean }>; // dealers with activity
  yearsRead: number[];
  configured: boolean;
  error?: string;
}

/** Read every journal year the portal keeps and build the store×dealer matrix. */
async function buildMatrix(): Promise<Matrix> {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = EARLIEST_JOURNAL_YEAR; y <= currentYear; y += 1) years.push(y);

  const [reads, index, canon] = await Promise.all([
    Promise.all(years.map((y) => readJournal(y))),
    loadDealerMatchIndex(),
    loadStoreCanon(),
  ]);
  const configured = reads.some((r) => r.configured);
  const error = reads.find((r) => r.error)?.error;

  const cells = new Map<string, Cell>();
  const dealers = new Map<string, { name: string; archived: boolean }>();

  for (const read of reads) {
    for (const d of read.deals) {
      if (d.result === 'RB') continue; // cancelled
      if (d.gross <= 0) continue; // dead/placeholder rows
      // Roll a mistyped store number into the real store it belongs to, so one
      // store isn't fragmented across phantom numbers (see storeCanon.ts).
      const store = canon.canonical(d.storeNumber, d.hdStore) || '';
      if (!store) continue; // non-store (outside-HD) rows belong to the office reports, not this cross-ref

      const dealerId = index.matchDeal(d) ?? '';
      const dealerName = dealerId ? index.nameById.get(dealerId) ?? dealerId : '(unmatched)';
      const archived = dealerId ? index.archived.has(dealerId) : false;
      if (dealerId) dealers.set(dealerId, { name: dealerName, archived });

      const key = `${store}||${dealerId}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = {
          storeNumber: store,
          dealerId,
          dealerName,
          archived,
          deals: 0,
          gross: 0,
          paidGross: 0,
          units: 0,
          firstSale: null,
          lastSale: null,
        };
        cells.set(key, cell);
      }
      cell.deals += 1;
      cell.gross += d.gross;
      cell.units += d.units;
      if (d.result === 'OK' && d.datePaid) cell.paidGross += d.gross;
      cell.firstSale = minDate(cell.firstSale, d.date);
      cell.lastSale = maxDate(cell.lastSale, d.date);
    }
  }

  return { cells, canon, dealers, yearsRead: years, configured, error };
}

function toStoreGroup(storeNumber: string, m: Matrix): StoreGroup {
  const storeName = m.canon.nameFor(storeNumber);
  const dealers: StoreDealerStat[] = [];
  for (const cell of m.cells.values()) {
    if (cell.storeNumber !== storeNumber) continue;
    dealers.push({
      dealerId: cell.dealerId,
      dealerName: cell.dealerName,
      archived: cell.archived,
      deals: cell.deals,
      gross: cell.gross,
      paidGross: cell.paidGross,
      units: cell.units,
      firstSale: cell.firstSale,
      lastSale: cell.lastSale,
    });
  }
  // Most-recently-active office first (so the current occupant leads), then $.
  dealers.sort(
    (a, b) => (b.lastSale?.getTime() ?? 0) - (a.lastSale?.getTime() ?? 0) || b.gross - a.gross,
  );
  return {
    storeNumber,
    storeLabel: m.canon.labelFor(storeNumber),
    storeName,
    dealers,
    totalDeals: dealers.reduce((acc, d) => acc + d.deals, 0),
    totalGross: dealers.reduce((acc, d) => acc + d.gross, 0),
  };
}

function toDealerGroup(dealerId: string, m: Matrix): DealerGroup {
  const meta = m.dealers.get(dealerId);
  const stores: DealerStoreStat[] = [];
  for (const cell of m.cells.values()) {
    if (cell.dealerId !== dealerId) continue;
    stores.push({
      storeNumber: cell.storeNumber,
      storeLabel: m.canon.labelFor(cell.storeNumber),
      storeName: m.canon.nameFor(cell.storeNumber),
      deals: cell.deals,
      gross: cell.gross,
      paidGross: cell.paidGross,
      units: cell.units,
      firstSale: cell.firstSale,
      lastSale: cell.lastSale,
    });
  }
  stores.sort((a, b) => b.gross - a.gross || (b.lastSale?.getTime() ?? 0) - (a.lastSale?.getTime() ?? 0));
  return {
    dealerId,
    dealerName: meta?.name ?? dealerId,
    archived: meta?.archived ?? false,
    stores,
    totalDeals: stores.reduce((acc, s) => acc + s.deals, 0),
    totalGross: stores.reduce((acc, s) => acc + s.gross, 0),
  };
}

/**
 * Build the report for a requested view.
 * @param mode  'store' (store → offices) or 'dealer' (office → stores)
 * @param selected  the chosen store number (store mode) or dealerId (dealer mode)
 */
export async function buildStoreDealerReport(
  mode: 'store' | 'dealer',
  selected: string | null,
): Promise<StoreDealerReport> {
  const m = await buildMatrix();

  const storeNumbers = Array.from(new Set(Array.from(m.cells.values()).map((c) => c.storeNumber)));
  const stores = storeNumbers
    .map((num) => ({ number: num, label: m.canon.labelFor(num) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));

  const dealers = Array.from(m.dealers.entries())
    .map(([id, v]) => ({ id, name: v.name, archived: v.archived }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let storeGroup: StoreGroup | null = null;
  let dealerGroup: DealerGroup | null = null;
  let allStores: StoreGroup[] = [];

  if (mode === 'dealer') {
    if (selected && m.dealers.has(selected)) dealerGroup = toDealerGroup(selected, m);
  } else {
    if (selected && storeNumbers.includes(selected)) {
      storeGroup = toStoreGroup(selected, m);
    } else {
      // Overview: every store with its office breakdown (the handover timeline).
      allStores = storeNumbers
        .map((num) => toStoreGroup(num, m))
        .sort((a, b) => a.storeLabel.localeCompare(b.storeLabel, 'en', { numeric: true }));
    }
  }

  return {
    mode,
    stores,
    dealers,
    storeGroup,
    dealerGroup,
    allStores,
    yearsRead: m.yearsRead,
    configured: m.configured,
    error: m.error,
  };
}

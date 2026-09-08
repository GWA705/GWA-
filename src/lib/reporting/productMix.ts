import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { getOffice, type Office } from './monthly';

/**
 * Product mix & attach rate — for one office in a year, which products were sold,
 * how often, and the average number of products per deal (an attach signal). Based
 * on the journal's product codes (e.g. "CITY,WS,WHCCF,SOAP"). Money basis matches
 * the monthly report (OK result, counted by date paid).
 *
 * Note: a deal's full value is counted toward EVERY product it contains, so the
 * per-product "$ in deals" column can exceed total volume by design — it answers
 * "how much revenue involved this product," not an exclusive split.
 */

export interface ProductMixRow {
  code: string;
  deals: number; // # of deals that included this product
  sharePct: number; // deals with this product ÷ total deals
  gross: number; // total $ of deals that included this product
}

export interface ProductMixReport {
  office: Office | null;
  year: number;
  configured: boolean;
  error?: string;
  totalDeals: number;
  totalGross: number;
  avgProductsPerDeal: number; // attach indicator
  products: ProductMixRow[];
}

function codesOf(product: string): string[] {
  return (product || '')
    .split(/[,/]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function buildProductMix(dealerId: string, year: number): Promise<ProductMixReport> {
  const office = await getOffice(dealerId);
  const cur = await readJournal(year);

  const storeSet = new Set(office?.storeNumbers ?? []);
  const belongs = (d: ReportDeal) => (d.storeNumber ? storeSet.has(d.storeNumber) : false);
  const isPaidOk = (d: ReportDeal) => d.result === 'OK' && !!d.datePaid && (d.datePaid as Date).getFullYear() === year;
  const deals = cur.deals.filter((d) => belongs(d) && isPaidOk(d));

  const map = new Map<string, ProductMixRow>();
  let totalGross = 0;
  let codeInstances = 0;
  for (const d of deals) {
    totalGross += d.gross;
    const codes = new Set(codesOf(d.product)); // unique per deal
    codeInstances += codes.size;
    for (const c of codes) {
      const r = map.get(c) ?? { code: c, deals: 0, sharePct: 0, gross: 0 };
      r.deals += 1;
      r.gross += d.gross;
      map.set(c, r);
    }
  }

  const totalDeals = deals.length;
  const products = Array.from(map.values())
    .map((r) => ({ ...r, sharePct: totalDeals > 0 ? Math.round((r.deals / totalDeals) * 100) : 0 }))
    .sort((a, b) => b.deals - a.deals || b.gross - a.gross);

  return {
    office,
    year,
    configured: cur.configured,
    error: cur.error,
    totalDeals,
    totalGross,
    avgProductsPerDeal: totalDeals > 0 ? Math.round((codeInstances / totalDeals) * 10) / 10 : 0,
    products,
  };
}

import 'server-only';
import { prisma } from '@/lib/db';
import type { ApplicationStatus, Prisma } from '@prisma/client';

/**
 * Average sale-price reporting by product and by package.
 *
 * A deal stores one total amount plus the list of products sold — there is no
 * per-product price. So:
 *  - a deal with EXACTLY ONE product tells us that product's stand-alone price;
 *  - a deal with TWO OR MORE products is a "package", grouped by the exact set
 *    of products sold (auto-detected — no hard-coded package list).
 *
 * Basis: approved-or-beyond deals, using the approved amount (falling back to
 * the requested amount) — i.e. real, accepted sale prices. Declined / withdrawn
 * / draft deals are excluded.
 */

// Approved-or-beyond — the sale was accepted.
const APPROVED_SALES: ApplicationStatus[] = [
  'CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED',
];

export interface PriceStat {
  key: string;
  label: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  total: number;
}

/** One counted deal, reduced to what the manual grouping tool needs. */
export interface PricingDeal {
  products: string[]; // cleaned product names
  amount: number;
}

export interface ProductPricingResult {
  dealsCounted: number; // deals with at least one product
  singleUnitDeals: number;
  packageDeals: number;
  products: PriceStat[]; // stand-alone (single-product) sales
  packages: PriceStat[]; // 2+ products sold together
  deals: PricingDeal[]; // raw rows for the manual "group these products" tool
  allProducts: string[]; // every distinct product seen, for the picker
}

const clean = (names: string[]): string[] =>
  Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));

function statFrom(key: string, label: string, amounts: number[]): PriceStat {
  const total = amounts.reduce((s, a) => s + a, 0);
  return {
    key,
    label,
    count: amounts.length,
    avg: amounts.length ? total / amounts.length : 0,
    min: amounts.length ? Math.min(...amounts) : 0,
    max: amounts.length ? Math.max(...amounts) : 0,
    total,
  };
}

export async function productPricing(opts: { dealerIds?: string[]; since?: Date } = {}): Promise<ProductPricingResult> {
  const where: Prisma.ApplicationWhereInput = { status: { in: APPROVED_SALES } };
  if (opts.dealerIds) where.dealerId = { in: opts.dealerIds };
  if (opts.since) where.createdAt = { gte: opts.since };

  const apps = await prisma.application.findMany({
    where,
    select: { productsSold: true, approvedAmount: true, requestedAmount: true },
  });

  // key -> { label, amounts[] }
  const products = new Map<string, { label: string; amounts: number[] }>();
  const packages = new Map<string, { label: string; amounts: number[] }>();
  const deals: PricingDeal[] = [];
  const allProducts = new Map<string, string>(); // lowercased key -> display label
  let dealsCounted = 0;
  let singleUnitDeals = 0;
  let packageDeals = 0;

  for (const a of apps) {
    const items = clean(a.productsSold);
    if (items.length === 0) continue;
    const amount = Number(a.approvedAmount ?? a.requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    dealsCounted++;
    deals.push({ products: items, amount });
    for (const it of items) if (!allProducts.has(it.toLowerCase())) allProducts.set(it.toLowerCase(), it);

    if (items.length === 1) {
      singleUnitDeals++;
      const label = items[0];
      const key = label.toLowerCase();
      const bucket = products.get(key) ?? { label, amounts: [] };
      bucket.amounts.push(amount);
      products.set(key, bucket);
    } else {
      packageDeals++;
      const sorted = [...items].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
      const key = sorted.map((s) => s.toLowerCase()).join(' + ');
      const label = sorted.join(' + ');
      const bucket = packages.get(key) ?? { label, amounts: [] };
      bucket.amounts.push(amount);
      packages.set(key, bucket);
    }
  }

  const toStats = (m: Map<string, { label: string; amounts: number[] }>): PriceStat[] =>
    [...m.entries()]
      .map(([key, v]) => statFrom(key, v.label, v.amounts))
      .sort((x, y) => y.count - x.count || y.avg - x.avg);

  return {
    dealsCounted,
    singleUnitDeals,
    packageDeals,
    products: toStats(products),
    packages: toStats(packages),
    deals,
    allProducts: [...allProducts.values()].sort((a, b) => a.localeCompare(b)),
  };
}

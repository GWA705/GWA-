import 'server-only';
import { prisma } from '@/lib/db';
import type { ApplicationStatus, Prisma } from '@prisma/client';

/**
 * Product & package pricing + unit counts.
 *
 * A deal stores one total amount plus the list of products sold — there is no
 * per-product price. So for AVERAGES:
 *  - a deal with EXACTLY ONE product tells us that product's stand-alone price;
 *  - a deal with TWO OR MORE products is a "package", grouped by the exact set.
 * Averages use approved-or-beyond deals, on the approved amount (fallback
 * requested).
 *
 * For COUNTS ("how many WS did we sell / approve / install"), every non-draft
 * deal is counted — one unit per product per deal — split into sold / approved /
 * installed. All active catalog products appear even with zero sales.
 */

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

/** One deal, reduced to what the manual grouping tool needs. */
export interface PricingDeal {
  products: string[];
  amount: number;
  approved: boolean;
  installed: boolean;
}

/** Per-product unit counts across all non-draft deals. */
export interface ProductCount {
  name: string;
  sold: number;
  approved: number;
  installed: number;
}

export interface ProductPricingResult {
  dealsCounted: number; // approved deals feeding the averages
  singleUnitDeals: number;
  packageDeals: number;
  products: PriceStat[]; // stand-alone (single-product) approved averages
  packages: PriceStat[]; // 2+ products sold together (approved)
  productCounts: ProductCount[]; // sold / approved / installed per product (all catalog)
  deals: PricingDeal[]; // rows for the manual "group these products" tool
  allProducts: string[]; // full catalog + any seen, for the picker
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
  const where: Prisma.ApplicationWhereInput = { status: { not: 'DRAFT' } };
  if (opts.dealerIds) where.dealerId = { in: opts.dealerIds };
  if (opts.since) where.createdAt = { gte: opts.since };

  const [apps, catalog] = await Promise.all([
    prisma.application.findMany({
      where,
      select: { productsSold: true, approvedAmount: true, requestedAmount: true, status: true, installationDate: true },
    }),
    prisma.product.findMany({ where: { active: true }, select: { name: true } }).catch(() => []),
  ]);

  const now = Date.now();
  const products = new Map<string, { label: string; amounts: number[] }>();
  const packages = new Map<string, { label: string; amounts: number[] }>();
  const counts = new Map<string, ProductCount>(); // key = lowercased
  const allProducts = new Map<string, string>();
  const deals: PricingDeal[] = [];
  let dealsCounted = 0;
  let singleUnitDeals = 0;
  let packageDeals = 0;

  // Seed the picker + counts with every active catalog product (so zero-sales
  // products still show and are selectable).
  for (const p of catalog) {
    const name = p.name.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (!allProducts.has(k)) allProducts.set(k, name);
    if (!counts.has(k)) counts.set(k, { name, sold: 0, approved: 0, installed: 0 });
  }

  for (const a of apps) {
    const items = clean(a.productsSold);
    if (items.length === 0) continue;
    const approved = APPROVED_SALES.includes(a.status);
    const installed = !!a.installationDate && a.installationDate.getTime() <= now;
    const amount = Number(a.approvedAmount ?? a.requestedAmount);

    deals.push({ products: items, amount: Number.isFinite(amount) ? amount : 0, approved, installed });

    // Unit counts (every product on the deal).
    for (const it of items) {
      const k = it.toLowerCase();
      if (!allProducts.has(k)) allProducts.set(k, it);
      const c = counts.get(k) ?? { name: it, sold: 0, approved: 0, installed: 0 };
      c.sold += 1;
      if (approved) c.approved += 1;
      if (installed) c.installed += 1;
      counts.set(k, c);
    }

    // Averages — approved deals with a valid amount only.
    if (!approved || !Number.isFinite(amount) || amount <= 0) continue;
    dealsCounted++;
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
    [...m.entries()].map(([key, v]) => statFrom(key, v.label, v.amounts)).sort((x, y) => y.count - x.count || y.avg - x.avg);

  return {
    dealsCounted,
    singleUnitDeals,
    packageDeals,
    products: toStats(products),
    packages: toStats(packages),
    productCounts: [...counts.values()].sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name)),
    deals,
    allProducts: [...allProducts.values()].sort((a, b) => a.localeCompare(b)),
  };
}

import 'server-only';
import { prisma } from '@/lib/db';
import { netBeforeTax } from '@/lib/tax';
import type { ApplicationStatus, Province, Prisma } from '@prisma/client';

/**
 * Product & package pricing + unit counts.
 *
 * A deal stores one total amount (tax INCLUDED) plus the list of products sold —
 * there is no per-product price. Every amount is reported two ways:
 *  - after-tax  = the stored total (sale with tax);
 *  - net        = pre-tax, backed out using the deal's province tax rate.
 *
 * Averages: a single-product deal feeds that product's stand-alone price; a
 * 2+ product deal is a "package" (auto-grouped by the exact set). Averages use
 * approved-or-beyond deals on the approved amount (fallback requested).
 *
 * Counts ("how many WS sold / approved / installed") use every non-draft deal —
 * one unit per product per deal. All active catalog products appear.
 */

const APPROVED_SALES: ApplicationStatus[] = [
  'CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED',
];

export interface PriceStat {
  key: string;
  label: string;
  count: number;
  avg: number; // after-tax
  min: number;
  max: number;
  total: number;
  avgNet: number; // pre-tax
  totalNet: number;
}

/** One deal, reduced to what the manual grouping tool needs. */
export interface PricingDeal {
  products: string[];
  amount: number; // after-tax
  net: number; // pre-tax
  approved: boolean;
  installed: boolean;
}

export interface ProductCount {
  name: string;
  sold: number;
  approved: number;
  installed: number;
}

export interface ProductPricingResult {
  dealsCounted: number;
  singleUnitDeals: number;
  packageDeals: number;
  products: PriceStat[];
  packages: PriceStat[];
  productCounts: ProductCount[];
  deals: PricingDeal[];
  allProducts: string[];
}

interface Row { gross: number; net: number; }

const clean = (names: string[]): string[] =>
  Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));

function statFrom(key: string, label: string, rows: Row[]): PriceStat {
  const grosses = rows.map((r) => r.gross);
  const total = grosses.reduce((s, a) => s + a, 0);
  const totalNet = rows.reduce((s, r) => s + r.net, 0);
  const n = rows.length;
  return {
    key,
    label,
    count: n,
    avg: n ? total / n : 0,
    min: n ? Math.min(...grosses) : 0,
    max: n ? Math.max(...grosses) : 0,
    total,
    avgNet: n ? totalNet / n : 0,
    totalNet,
  };
}

export async function productPricing(opts: { dealerIds?: string[]; since?: Date } = {}): Promise<ProductPricingResult> {
  const where: Prisma.ApplicationWhereInput = { status: { not: 'DRAFT' } };
  if (opts.dealerIds) where.dealerId = { in: opts.dealerIds };
  if (opts.since) where.createdAt = { gte: opts.since };

  const [apps, catalog] = await Promise.all([
    prisma.application.findMany({
      where,
      select: { productsSold: true, approvedAmount: true, requestedAmount: true, status: true, installationDate: true, province: true },
    }),
    prisma.product.findMany({ where: { active: true }, select: { name: true } }).catch(() => []),
  ]);

  const now = Date.now();
  const products = new Map<string, { label: string; rows: Row[] }>();
  const packages = new Map<string, { label: string; rows: Row[] }>();
  const counts = new Map<string, ProductCount>();
  const allProducts = new Map<string, string>();
  const deals: PricingDeal[] = [];
  let dealsCounted = 0;
  let singleUnitDeals = 0;
  let packageDeals = 0;

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
    const gross = Number.isFinite(amount) ? amount : 0;
    const net = netBeforeTax(gross, a.province as Province | null).net;

    deals.push({ products: items, amount: gross, net, approved, installed });

    for (const it of items) {
      const k = it.toLowerCase();
      if (!allProducts.has(k)) allProducts.set(k, it);
      const c = counts.get(k) ?? { name: it, sold: 0, approved: 0, installed: 0 };
      c.sold += 1;
      if (approved) c.approved += 1;
      if (installed) c.installed += 1;
      counts.set(k, c);
    }

    if (!approved || gross <= 0) continue;
    dealsCounted++;
    const row: Row = { gross, net };
    if (items.length === 1) {
      singleUnitDeals++;
      const label = items[0];
      const key = label.toLowerCase();
      const bucket = products.get(key) ?? { label, rows: [] };
      bucket.rows.push(row);
      products.set(key, bucket);
    } else {
      packageDeals++;
      const sorted = [...items].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
      const key = sorted.map((s) => s.toLowerCase()).join(' + ');
      const label = sorted.join(' + ');
      const bucket = packages.get(key) ?? { label, rows: [] };
      bucket.rows.push(row);
      packages.set(key, bucket);
    }
  }

  const toStats = (m: Map<string, { label: string; rows: Row[] }>): PriceStat[] =>
    [...m.entries()].map(([key, v]) => statFrom(key, v.label, v.rows)).sort((x, y) => y.count - x.count || y.avg - x.avg);

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

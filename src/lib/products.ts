import { prisma } from '@/lib/db';
import { journalCodeFromName } from '@/lib/journalCode';

export interface ProductOption {
  id: string;
  name: string;
  /** Abbreviated code written to the journal (e.g. "UV12"); null → use full name. */
  journalName?: string | null;
  /** True when this option was surfaced automatically (typed via "Other" on 3+ deals). */
  promoted?: boolean;
}

/**
 * The "Product(s) sold" checklist options for a given dealer: the admin's active
 * products (shared by everyone), plus any product THIS dealer explicitly added to
 * their own list (the "add to my list" opt-in on the new-deal form).
 *
 * Custom products are scoped per dealer, so one dealer's additions show up only
 * on that dealer's list — not for every dealer. Names that already exist as a
 * Product — active OR archived — are never surfaced, so an archived/removed
 * product (e.g. SOAP) can't reappear. Pass no dealerId (e.g. an admin preview) to
 * get just the shared active products with no additions.
 */
export async function productChecklistOptions(dealerId?: string | null): Promise<ProductOption[]> {
  const [active, all] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, journalName: true },
    }),
    prisma.product.findMany({ select: { name: true } }),
  ]);

  const base = active.map((p) => ({ id: p.id, name: p.name, journalName: p.journalName }));
  if (!dealerId) return base;

  // This dealer's explicitly-added custom products.
  const custom = await prisma.dealerCustomProduct.findMany({
    where: { dealerId },
    select: { id: true, name: true, journalName: true },
  });

  const known = new Set(all.map((p) => p.name.trim().toLowerCase()));
  const seen = new Set<string>();
  const promoted: ProductOption[] = [];
  for (const row of custom) {
    const name = row.name.trim();
    const key = name.toLowerCase();
    if (!name || known.has(key) || seen.has(key)) continue;
    seen.add(key);
    promoted.push({ id: row.id, name, journalName: row.journalName ?? journalCodeFromName(name), promoted: true });
  }
  promoted.sort((a, b) => a.name.localeCompare(b.name));

  return [...base, ...promoted];
}

/**
 * Add product names to a dealer's custom list (the "add to my list" opt-in).
 * Skips names that are blank or already an admin Product; idempotent per dealer.
 */
export async function addDealerCustomProducts(dealerId: string, names: string[]): Promise<void> {
  const clean = Array.from(
    new Set(names.map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean).map((n) => n)),
  );
  if (clean.length === 0) return;
  const existing = await prisma.product.findMany({ select: { name: true } });
  const known = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  const toAdd = clean.filter((n) => !known.has(n.toLowerCase()));
  if (toAdd.length === 0) return;
  await prisma.dealerCustomProduct.createMany({
    data: toAdd.map((name) => ({ dealerId, name, journalName: journalCodeFromName(name) || null })),
    skipDuplicates: true,
  });
}

/**
 * Map the deal's stored product NAMES to what should be written to the sales
 * journal: each product's abbreviated `journalName` when set, otherwise the full
 * name (so free-text "Other" entries and abbreviation-less products still write
 * something sensible). Matching is case-insensitive and preserves order.
 */
export async function journalProductNames(names: string[], dealerId?: string | null): Promise<string[]> {
  if (names.length === 0) return [];
  const [products, custom] = await Promise.all([
    prisma.product.findMany({ select: { name: true, journalName: true } }),
    dealerId
      ? prisma.dealerCustomProduct.findMany({ where: { dealerId }, select: { name: true, journalName: true } })
      : Promise.resolve([]),
  ]);
  const abbrev = new Map<string, string>();
  // Admin products first, then the dealer's custom codes (which win for their
  // own product names). A custom product with no stored code derives one.
  for (const p of products) {
    const j = (p.journalName ?? '').trim();
    if (j) abbrev.set(p.name.trim().toLowerCase(), j);
  }
  for (const c of custom) {
    const j = (c.journalName ?? '').trim() || journalCodeFromName(c.name);
    if (j) abbrev.set(c.name.trim().toLowerCase(), j);
  }
  return names.map((n) => abbrev.get(n.trim().toLowerCase()) ?? n);
}

/**
 * Merge the checkbox selections with the free-text "Other" field into the final
 * productsSold list. Custom entries are comma-separated, trimmed, de-duplicated
 * case-insensitively against each other, and capped.
 */
export function mergeProductsSold(selected: string[], other: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const name = raw.replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  selected.forEach(push);
  (other ?? '').split(',').forEach(push);
  return out.slice(0, 50);
}

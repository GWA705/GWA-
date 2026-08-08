import { prisma } from '@/lib/db';

export interface ProductOption {
  id: string;
  name: string;
  /** True when this option was surfaced automatically (typed via "Other" on 3+ deals). */
  promoted?: boolean;
}

/**
 * The "Product(s) sold" checklist options for a given dealer: the admin's active
 * products (shared by everyone), plus any product name that THIS dealer has typed
 * into "Other" on more than two of their own deals.
 *
 * Promotion is scoped per dealer, so a product one dealer keeps selling shows up
 * only on that dealer's list — not for every dealer. Names that already exist as
 * a Product — active OR archived — are never promoted, so an archived/removed
 * product (e.g. SOAP) can't reappear. Pass no dealerId (e.g. an admin preview)
 * to get just the shared active products with no promotions.
 */
export async function productChecklistOptions(dealerId?: string | null): Promise<ProductOption[]> {
  const [active, all] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({ select: { name: true } }),
  ]);

  const base = active.map((p) => ({ id: p.id, name: p.name }));
  if (!dealerId) return base;

  // This dealer's own repeat "Other" entries.
  const usage = await prisma.$queryRaw<{ name: string | null }[]>`
    SELECT name
    FROM (SELECT unnest("productsSold") AS name FROM "Application" WHERE "dealerId" = ${dealerId}) s
    GROUP BY name
    HAVING count(*) > 2
  `;

  const known = new Set(all.map((p) => p.name.trim().toLowerCase()));
  const seen = new Set<string>();
  const promoted: ProductOption[] = [];
  for (const row of usage) {
    const name = (row.name ?? '').trim();
    const key = name.toLowerCase();
    if (!name || known.has(key) || seen.has(key)) continue;
    seen.add(key);
    promoted.push({ id: `promo:${name}`, name, promoted: true });
  }
  promoted.sort((a, b) => a.name.localeCompare(b.name));

  return [...base, ...promoted];
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

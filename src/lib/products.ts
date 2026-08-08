import { prisma } from '@/lib/db';

export interface ProductOption {
  id: string;
  name: string;
  /** True when this option was surfaced automatically (typed via "Other" on 3+ deals). */
  promoted?: boolean;
}

/**
 * The "Product(s) sold" checklist options: the admin's active products, plus any
 * product name that dealers have typed into "Other" on more than two deals.
 *
 * A typed name is auto-promoted once it appears on 3+ applications, so a product
 * that's actually being sold shows up on its own without an admin adding it.
 * Names that already exist as a Product — active OR archived — are never
 * promoted, so an archived/removed product (e.g. SOAP) can't reappear.
 */
export async function productChecklistOptions(): Promise<ProductOption[]> {
  const [active, all, usage] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({ select: { name: true } }),
    prisma.$queryRaw<{ name: string | null }[]>`
      SELECT name
      FROM (SELECT unnest("productsSold") AS name FROM "Application") s
      GROUP BY name
      HAVING count(*) > 2
    `,
  ]);

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

  return [...active.map((p) => ({ id: p.id, name: p.name })), ...promoted];
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

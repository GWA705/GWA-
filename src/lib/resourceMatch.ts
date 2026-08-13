import 'server-only';
import { prisma } from './db';
import { RESOURCE_FILE_KIND_LABELS } from './constants';

/**
 * Best-effort match of the products on a deal (free-text names from the sales
 * catalog) to entries in the Resource library, so a customer-assist view can
 * link straight to the right manuals/brochures. Matches by normalized substring
 * either direction (a product name inside a resource title or vice-versa).
 */

export interface MatchedManual {
  productId: string;
  title: string;
  brand: string | null;
  hasImage: boolean;
  files: { id: string; kindLabel: string; label: string; isPdf: boolean }[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function matchManualsForProducts(productNames: string[]): Promise<MatchedManual[]> {
  const names = productNames.map(norm).filter((n) => n.length >= 2);
  if (names.length === 0) return [];

  const products = await prisma.resourceProduct.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      brand: true,
      imageStorageKey: true,
      files: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, kind: true, label: true, mime: true } },
    },
  });

  const matched: MatchedManual[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const t = norm(`${p.title} ${p.brand ?? ''}`);
    const hit = names.some((n) => t.includes(n) || n.split(' ').some((w) => w.length >= 3 && t.includes(w)));
    if (!hit || seen.has(p.id)) continue;
    seen.add(p.id);
    matched.push({
      productId: p.id,
      title: p.title,
      brand: p.brand,
      hasImage: !!p.imageStorageKey,
      files: p.files.map((f) => ({ id: f.id, kindLabel: RESOURCE_FILE_KIND_LABELS[f.kind], label: f.label || RESOURCE_FILE_KIND_LABELS[f.kind], isPdf: f.mime === 'application/pdf' })),
    });
  }
  return matched;
}

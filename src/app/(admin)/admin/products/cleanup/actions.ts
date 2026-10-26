'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { setProductAliases, type ProductAliasMap } from '@/lib/reporting/productCanon';

/** Save the product-code merges (raw code → canonical). Only entries that differ
 *  from the code itself are kept; clearing them all removes the override. */
export async function saveProductAliasesAction(formData: FormData): Promise<void> {
  await requireAdminSection('products');
  const map: ProductAliasMap = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('canon:')) {
      const code = k.slice(6);
      const canon = typeof v === 'string' ? v : '';
      if (code && canon) map[code] = canon;
    }
  }
  await setProductAliases(map);
  revalidatePath('/admin/products/cleanup');
}

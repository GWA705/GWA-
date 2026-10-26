import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { listJournalProductCodes } from '@/lib/reporting/productMix';
import { getProductAliases, suggestClusters, makeProductCanon } from '@/lib/reporting/productCanon';
import { saveProductAliasesAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Admin → Products → Clean up codes. The sales journal's product column is free
 * text, so the same product shows up under several codes (case/spacing/typo/
 * variant). This lists every distinct code, pre-groups the look-alikes, and lets
 * you merge each into one canonical — which the product reports then use.
 */
export default async function ProductCleanupPage({ searchParams }: { searchParams: { year?: string } }) {
  await requireAdminSection('products');
  const now = new Date().getFullYear();
  const year = /^\d{4}$/.test(searchParams.year || '') ? Number(searchParams.year) : now;
  const years = [now, now - 1, now - 2];

  const [codes, aliases] = await Promise.all([listJournalProductCodes(year), getProductAliases()]);
  const count = new Map(codes.map((c) => [c.code, c.count]));
  const clusters = suggestClusters(codes.map((c) => c.code))
    .map((m) => m.slice().sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0)))
    .sort((a, b) => b.reduce((s, c) => s + (count.get(c) || 0), 0) - a.reduce((s, c) => s + (count.get(c) || 0), 0));
  const clustered = new Set(clusters.flat());
  const loose = codes.filter((c) => !clustered.has(c.code));
  const canon = makeProductCanon(aliases);
  const distinctAfter = new Set(codes.map((c) => canon(c.code))).size;

  const inp = 'w-44 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-mono';
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-gray-200';

  function Pill({ n }: { n: number }) {
    return <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">{n}</span>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Clean up product codes</h1>
        <Link href="/admin/products" className="ml-auto text-sm font-medium text-brand-700 hover:underline">← Products</Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Merge the same product's look-alike codes into one. Reports (product mix &amp; attach rate) then count the canonical code.
        A code left mapped to itself is unchanged.
      </p>

      <form method="get" className="mt-4 flex items-center gap-2">
        <select name="year" defaultValue={String(year)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-900">View year</button>
        <span className="ml-auto text-sm text-gray-500">
          <strong>{codes.length}</strong> raw codes → <strong>{distinctAfter}</strong> after your saved merges
        </span>
      </form>

      <form action={saveProductAliasesAction} className="mt-5 space-y-5">
        {/* Suggested duplicates */}
        <div>
          <h2 className="text-sm font-bold text-gray-900">Suggested duplicates <span className="font-normal text-gray-400">· {clusters.length} group{clusters.length === 1 ? '' : 's'}</span></h2>
          <p className="mt-0.5 text-xs text-gray-500">Each group is pre-filled to merge into its most-used code. Edit the canonical, or clear it back to the raw code to keep a code separate.</p>
          <div className="mt-3 space-y-3">
            {clusters.length === 0 && <div className={`${card} p-5 text-center text-sm text-gray-400`}>No look-alikes detected for {year}.</div>}
            {clusters.map((members, i) => {
              const top = members[0];
              return (
                <div key={i} className={`${card} p-4`}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {members.map((m) => (
                      <label key={m} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                        <span className="min-w-0 truncate font-mono text-sm text-gray-800">{m}<Pill n={count.get(m) || 0} /></span>
                        <input name={`canon:${m}`} defaultValue={aliases[m] ?? top} className={inp} />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Everything else, for manual mapping */}
        <details className={`${card} p-5`}>
          <summary className="cursor-pointer text-sm font-bold text-gray-900">All other codes <span className="font-normal text-gray-400">· {loose.length}</span></summary>
          <p className="mt-1 text-xs text-gray-500">Codes with no obvious match. Map one into another product if you know it's the same; otherwise leave it.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {loose.map((c) => (
              <label key={c.code} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-sm text-gray-800">{c.code}<Pill n={c.count} /></span>
                <input name={`canon:${c.code}`} defaultValue={aliases[c.code] ?? c.code} className={inp} />
              </label>
            ))}
          </div>
        </details>

        <div className="sticky bottom-4">
          <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-700">Save merges</button>
        </div>
      </form>
    </div>
  );
}

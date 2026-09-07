import { Droplets } from 'lucide-react';
import { getT } from '@/i18n/server';

/** Program mix (e.g. HD · Water) as labelled progress bars. */
export function ProgramBreakdown({ items }: { items: { label: string; count: number; pct: number }[] }) {
  const t = getT();
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_30px_-18px_rgba(16,24,40,.22)]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15">
          <Droplets size={17} />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d2a63] dark:text-slate-100">{t('dashboard.programBreakdown')}</h3>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">{t('dashboard.noProgramsYet')}</p>
      ) : (
        <div className="space-y-4">
          {items.map((p) => (
            <div key={p.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-gray-700">{p.label}</span>
                <span className="flex-none text-xs font-medium tabular-nums text-gray-500">
                  <span className="font-bold text-[#10265a] dark:text-slate-100">{p.count}</span> · {p.pct}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="gwa-grow-right h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                  style={{ width: `${Math.max(3, p.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

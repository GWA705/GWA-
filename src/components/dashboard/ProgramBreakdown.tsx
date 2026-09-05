import { Droplets } from 'lucide-react';

/** Program mix (e.g. HD · Water) as labelled progress bars. */
export function ProgramBreakdown({ items }: { items: { label: string; count: number; pct: number }[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Droplets size={18} className="text-blue-600" />
        <h3 className="font-bold text-[#0d2a63] dark:text-slate-100">Program Breakdown</h3>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">No programs yet.</p>
      ) : (
        <div className="space-y-3 py-2">
          {items.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <div className="w-28 flex-none truncate text-sm text-gray-700">{p.label}</div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${p.pct}%` }} />
              </div>
              <div className="w-16 flex-none text-right text-sm tabular-nums text-gray-500">{p.count} ({p.pct}%)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

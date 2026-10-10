import Link from 'next/link';

// Server-rendered usage charts — pure SVG/CSS, no client JS. Styled to match the
// admin console (sky accent on gray). Shared by the report and the per-user page.

const nf = (n: number) => n.toLocaleString('en-CA');

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

export interface BarRow { label: string; count: number; href?: string; sub?: string | null }

export function HBars({ rows }: { rows: BarRow[] }) {
  if (!rows.length) return <p className="text-sm text-gray-400">No activity in this period.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[minmax(7rem,38%)_1fr_auto] items-center gap-3">
          <div className="min-w-0 truncate text-sm text-gray-700">
            {r.href ? <Link href={r.href} className="font-medium text-sky-700 hover:underline">{r.label}</Link> : r.label}
            {r.sub ? <span className="ml-1 text-xs text-gray-400">{r.sub}</span> : null}
          </div>
          <div className="h-4 rounded bg-gray-100">
            <div className="h-4 rounded bg-sky-500" style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} />
          </div>
          <div className="w-12 text-right text-sm font-semibold tabular-nums text-gray-900">{nf(r.count)}</div>
        </li>
      ))}
    </ul>
  );
}

// Fill a sparse day series with zeros across the whole window so the axis is
// continuous. `daily` holds YYYY-MM-DD (office tz) → count.
function fillDaily(daily: { date: string; count: number }[], days: number): { date: string; count: number }[] {
  const map = new Map(daily.map((d) => [d.date, d.count]));
  const out: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export function TrendChart({ daily, days }: { daily: { date: string; count: number }[]; days: number }) {
  const series = fillDaily(daily, days);
  if (!series.some((d) => d.count > 0)) return <p className="text-sm text-gray-400">No activity in this period.</p>;
  const W = 720, H = 160, m = { t: 8, r: 8, b: 20, l: 30 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...series.map((d) => d.count), 1);
  const x = (i: number) => m.l + (series.length <= 1 ? 0 : (i / (series.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1).toFixed(1)},${(m.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(m.t + ih).toFixed(1)} Z`;
  const ticks = [0, Math.round(max / 2), max];
  const everyN = Math.max(1, Math.floor(series.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Actions per day" className="overflow-visible">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" />
          <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="#9ca3af">{nf(t)}</text>
        </g>
      ))}
      <path d={area} fill="#0ea5e9" fillOpacity="0.14" />
      <path d={line} fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {series.map((d, i) => (i % everyN === 0 ? (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.date.slice(5)}</text>
      ) : null))}
    </svg>
  );
}

export function HourChart({ hours }: { hours: { hour: number; count: number }[] }) {
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hours.find((x) => x.hour === h)?.count ?? 0 }));
  if (!byHour.some((h) => h.count > 0)) return <p className="text-sm text-gray-400">No activity in this period.</p>;
  const W = 720, H = 150, m = { t: 8, r: 6, b: 18, l: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...byHour.map((h) => h.count), 1);
  const bw = iw / 24;
  const fmtHour = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Actions by hour" className="overflow-visible">
      {[0, Math.round(max / 2), max].map((t, i) => (
        <g key={i}>
          <line x1={m.l} x2={W - m.r} y1={m.t + ih - (t / max) * ih} y2={m.t + ih - (t / max) * ih} stroke="#e5e7eb" />
          <text x={m.l - 6} y={m.t + ih - (t / max) * ih} dy="0.32em" textAnchor="end" fontSize="10" fill="#9ca3af">{nf(t)}</text>
        </g>
      ))}
      {byHour.map((h) => {
        const bh = (h.count / max) * ih;
        return <rect key={h.hour} x={m.l + h.hour * bw + bw * 0.15} y={m.t + ih - bh} width={bw * 0.7} height={bh} rx="1.5" fill="#0ea5e9" />;
      })}
      {byHour.filter((h) => h.hour % 3 === 0).map((h) => (
        <text key={h.hour} x={m.l + h.hour * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize="10" fill="#9ca3af">{fmtHour(h.hour)}</text>
      ))}
    </svg>
  );
}

export function RangeTabs({ days, base }: { days: number; base: string }) {
  const opts = [7, 30, 90];
  return (
    <div className="inline-flex gap-1.5">
      {opts.map((d) => (
        <Link
          key={d}
          href={`${base}?days=${d}`}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${d === days ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Last {d} days
        </Link>
      ))}
    </div>
  );
}

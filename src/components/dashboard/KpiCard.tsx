import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

type Tone = 'blue' | 'green' | 'amber';

const TONES: Record<Tone, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
};

/** A dashboard KPI tile: coloured icon, big value, subtitle. Optionally a link. */
export function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  tone = 'blue',
  href,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle: string;
  tone?: Tone;
  href?: string;
}) {
  const inner = (
    <div className="flex h-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`flex h-14 w-14 flex-none items-center justify-center rounded-full text-white ${TONES[tone]}`}>
        <Icon size={26} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-600">{title}</div>
        <div className="text-3xl font-extrabold leading-tight text-[#10265a]">{value}</div>
        <div className="truncate text-sm text-slate-500">{subtitle}</div>
      </div>
      {href && <ChevronRight size={20} className="flex-none text-slate-300" />}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

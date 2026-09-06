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
    <div className="flex h-full items-center gap-2.5 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm transition hover:shadow-md sm:gap-4 sm:p-5">
      <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-white sm:h-14 sm:w-14 ${TONES[tone]}`}>
        <Icon className="h-5 w-5 sm:h-[26px] sm:w-[26px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-gray-600 sm:text-sm">{title}</div>
        <div className="truncate text-xl font-extrabold leading-tight text-[#10265a] tabular-nums dark:text-slate-100 sm:text-3xl">{value}</div>
        <div className="truncate text-xs text-gray-500 sm:text-sm">{subtitle}</div>
      </div>
      {href && <ChevronRight size={20} className="hidden flex-none text-gray-300 sm:block" />}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

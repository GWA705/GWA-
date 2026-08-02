import type { ProgramType } from '@prisma/client';

// HD and GWA deals use different financing, so the reviewer must never confuse
// them. This badge is deliberately loud and color-coded — HD is Home-Depot
// orange, GWA is brand blue — so the program type reads at a glance everywhere
// a deal appears (queue, cards, and the deal header).
const STYLES: Record<ProgramType, string> = {
  HD: 'bg-orange-500 text-white ring-orange-600/20',
  GWA: 'bg-brand-600 text-white ring-brand-700/20',
};

export function ProgramBadge({
  type,
  category,
  size = 'sm',
  className = '',
}: {
  type: ProgramType;
  /** Optional category (e.g. "Water") appended after the type. */
  category?: string;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const sizing = size === 'lg' ? 'px-2.5 py-1 text-sm' : 'px-1.5 py-0.5 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wide ring-1 ring-inset ${STYLES[type]} ${sizing} ${className}`}
      title={`${type} deal`}
    >
      {type}
      {category && <span className="font-semibold normal-case opacity-90">· {category}</span>}
    </span>
  );
}

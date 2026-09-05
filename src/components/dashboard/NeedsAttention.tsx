import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { ApplicationStatus } from '@prisma/client';

export interface AttentionItem {
  id: string;
  name: string;
  status: ApplicationStatus;
  /** Reviewer flagged an issue / sent it back — shown red with a "!". */
  problem: boolean;
}

/**
 * "Needs your attention" — deals the dealer has to act on, with reviewer
 * send-backs (PROBLEM) surfaced first and flagged red. Renders nothing when the
 * queue is clear, so it only appears when there's actually something to do.
 */
export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  const problems = items.filter((i) => i.problem).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/70 shadow-sm">
      <div className="flex items-center gap-3 border-b border-red-100 px-5 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-600 text-lg font-black leading-none text-white">!</span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-red-800">Needs your attention</h3>
          <p className="text-xs text-red-700/80">
            {problems > 0 && <>{problems} sent back by the reviewer · </>}
            {items.length} item{items.length > 1 ? 's' : ''} to action
          </p>
        </div>
      </div>
      <ul className="divide-y divide-red-100">
        {items.map((i) => (
          <li key={i.id}>
            <Link
              href={`/dealer/applications/${i.id}`}
              className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-red-100/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                {i.problem ? (
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-red-600 text-[13px] font-black leading-none text-white">!</span>
                ) : (
                  <AlertTriangle size={18} className="flex-none text-amber-500" />
                )}
                <span className="truncate text-sm font-semibold text-gray-800">{i.name}</span>
                <span className="hidden sm:block"><StatusBadge status={i.status} /></span>
              </div>
              <span className="flex flex-none items-center gap-1 text-xs font-semibold text-red-700">
                {i.problem ? 'Resolve issue' : 'Review'} <ArrowRight size={14} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

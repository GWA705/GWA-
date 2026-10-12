import Link from 'next/link';
import { Sunrise } from 'lucide-react';
import { markCaughtUpAction } from '@/app/(staff)/actions';
import { getT } from '@/i18n/server';
import type { CatchUp, CatchUpItem } from '@/lib/catchUp';

function Tile({ n, label, href, tone }: { n: number; label: string; href: string; tone: 'brand' | 'warn' | 'crit' }) {
  const num =
    tone === 'warn' ? 'text-amber-700' : tone === 'crit' ? 'text-red-600' : 'text-brand-700';
  return (
    <Link href={href} className="rounded-lg border border-gray-200 bg-gray-50 p-3 transition hover:border-gray-300 hover:bg-gray-100">
      <div className={`text-2xl font-extrabold leading-none tabular-nums ${num}`}>{n}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </Link>
  );
}

function ItemRow({ item }: { item: CatchUpItem }) {
  return (
    <Link
      href={`/staff/applications/${item.applicationId}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 transition hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="min-w-0">
        <div className="truncate text-sm">
          <span className="font-medium text-brand-700">{item.name}</span>
          {item.office && <span className="text-gray-500"> · {item.office}</span>}
        </div>
        {item.preview && <div className="truncate text-xs text-gray-500">“{item.preview}”</div>}
      </div>
      <span className="whitespace-nowrap text-xs text-gray-400">{item.timeLabel}</span>
    </Link>
  );
}

/**
 * Morning catch-up — a once-a-day "what happened since you were last here"
 * briefing at the top of the reviewer queue. Renders nothing when there's
 * nothing new. "Mark caught up" advances the window so it clears until the next
 * thing happens.
 */
export function MorningCatchUp({ data }: { data: CatchUp }) {
  if (data.total === 0) return null;
  const { counts } = data;
  const t = getT();
  return (
    <section className="card mb-6 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sunrise size={18} className="text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900">{t('leadUi.morning.title')}</h2>
          <span className="text-xs text-gray-500">{t('leadUi.morning.since', { date: data.sinceLabel })}</span>
        </div>
        <form action={markCaughtUpAction}>
          <button type="submit" className="btn-secondary text-sm">{t('leadUi.morning.markCaughtUp')}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile n={counts.issueReplies} label={t('leadUi.morning.issueReplies')} href="/staff/confirmations" tone="warn" />
        <Tile n={counts.newDeals} label={t('leadUi.morning.newDeals')} href="/staff" tone="brand" />
        <Tile n={counts.fundingIn} label={t('leadUi.morning.fundingIn')} href="/staff" tone="brand" />
        <Tile n={counts.cancellations} label={t('leadUi.morning.cancellations')} href="/staff/cancellations" tone="crit" />
      </div>

      {data.replies.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('leadUi.morning.repliesWaiting')}</h3>
          <div className="flex flex-col gap-2">
            {data.replies.map((r) => (
              <ItemRow key={r.applicationId} item={r} />
            ))}
          </div>
        </div>
      )}

      {data.cancellations.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('leadUi.morning.needsDecision')}</h3>
          <div className="flex flex-col gap-2">
            {data.cancellations.map((c) => (
              <ItemRow key={c.applicationId} item={c} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

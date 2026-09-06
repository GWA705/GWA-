'use client';

import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/client';

/**
 * Compact "HD Leads" pill for the dashboard right rail (above the Support pill).
 *
 * Drop a banner image at `public/leads-pill.png` and it fills the pill edge to
 * edge (cover — just the image, no surrounding box). Until one is added, the
 * icon + label card below shows instead. The banner has a fixed aspect so the
 * image reads as a clean strip; a missing file simply leaves the fallback card.
 */
export function LeadsPill() {
  const t = useT();
  return (
    <Link
      href="/dealer/leads"
      aria-label={t('leadsPill.title')}
      className="group relative block aspect-[1000/230] overflow-hidden rounded-2xl border border-blue-100 shadow-sm transition hover:shadow-md dark:border-blue-900/40"
    >
      {/* Fallback card (shows when no image is present) */}
      <div className="absolute inset-0 flex items-center justify-between gap-3 bg-[#f4f8fd] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-blue-600 text-white">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight text-[#0e2b5c] dark:text-slate-100">{t('leadsPill.title')}</div>
            <div className="truncate text-xs text-gray-500">{t('leadsPill.subtitle')}</div>
          </div>
        </div>
        <ArrowRight size={16} className="flex-none text-blue-600" />
      </div>

      {/* Banner image — fills the pill (cover); absent file → fallback stays visible */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/leads-pill.png')" }}
        aria-hidden
      />
    </Link>
  );
}

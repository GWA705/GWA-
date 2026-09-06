'use client';

import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/client';

/**
 * "HD Leads" banner pill for the dashboard right rail (above the Support pill).
 *
 * Drop a banner image at `public/leads-pill.png` and it fills the pill (cover).
 * The "HD Leads" label + lead icon + arrow always sit on top over a bottom
 * scrim, so it's clear the banner is clickable. With no image, a solid navy
 * background shows behind the same label.
 */
export function LeadsPill() {
  const t = useT();
  return (
    <Link
      href="/dealer/leads"
      aria-label={t('leadsPill.title')}
      className="group relative block aspect-[3/1] overflow-hidden rounded-2xl border border-blue-100 shadow-sm transition hover:shadow-md dark:border-blue-900/40"
    >
      {/* Base (shows when no image is present) */}
      <div className="absolute inset-0 bg-[#0e2b5c]" aria-hidden />
      {/* Banner image — fills the pill (cover) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/leads-pill.png')" }}
        aria-hidden
      />
      {/* Scrim so the label stays legible over any image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" aria-hidden />
      {/* Label — always on top */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm">
            <Users size={16} />
          </span>
          <span className="text-sm font-bold text-white drop-shadow">{t('leadsPill.title')}</span>
        </span>
        <ArrowRight size={18} className="flex-none text-white drop-shadow transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

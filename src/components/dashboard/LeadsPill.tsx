'use client';

import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/client';

/**
 * Compact "HD Leads" pill for the dashboard right rail — sits just above the
 * Support pill. Same slim footprint as the Support card so the two read as a
 * pair. Links to the Leads workspace.
 */
export function LeadsPill() {
  const t = useT();
  return (
    <Link
      href="/dealer/leads"
      className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-blue-100 bg-[#f4f8fd] p-4 shadow-sm transition hover:bg-blue-50 dark:border-blue-900/40"
    >
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
    </Link>
  );
}

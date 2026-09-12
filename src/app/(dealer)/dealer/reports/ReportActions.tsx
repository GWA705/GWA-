'use client';

import { useState, useTransition } from 'react';
import { emailDealerReport } from './emailReportActions';
import { useT } from '@/i18n/client';

/**
 * Print / Email controls for a dealer report. Print uses the app's global print
 * convention (the report body sits in a `.print-sheet` wrapper, so only it prints).
 * Email sends the signed-in dealer a link to this exact report (current filters
 * included) — to their own account email only. Hidden from the printout (`no-print`).
 */
export function ReportActions({ title, showPrint = true, showEmail = true }: { title: string; showPrint?: boolean; showEmail?: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const onEmail = () => {
    setMsg(null);
    const path = window.location.pathname + window.location.search;
    start(async () => {
      const r = await emailDealerReport(path, title);
      setMsg(r.message);
    });
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {showPrint && (
        <button type="button" onClick={() => window.print()} className="btn-secondary text-sm">
          🖨 {t('reportActions.print')}
        </button>
      )}
      {showEmail && (
        <button type="button" onClick={onEmail} disabled={pending} className="btn-secondary text-sm disabled:opacity-60">
          ✉ {pending ? t('reportActions.emailing') : t('reportActions.email')}
        </button>
      )}
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}

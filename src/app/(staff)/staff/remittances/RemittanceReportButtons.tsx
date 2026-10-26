'use client';

import { useState } from 'react';
import { emailRemittanceReportAction } from './actions';

/**
 * Get the matched-report PDF: view/download it now, or email it to the office
 * team on demand (it also auto-emails whenever a remittance is processed).
 */
export function RemittanceReportButtons({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/staff/remittances/${id}/report`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary text-sm"
      >
        ⬇ Download matched report (PDF)
      </a>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg(null); setErr(null);
          const res = await emailRemittanceReportAction(id);
          if (res?.error) setErr(res.error);
          else setMsg(res?.summary ?? 'Report emailed.');
          setBusy(false);
        }}
        className="btn-secondary text-sm"
      >
        {busy ? 'Emailing…' : '✉️ Email report to office team'}
      </button>
      {msg && <span className="text-xs text-green-600">✓ {msg}</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

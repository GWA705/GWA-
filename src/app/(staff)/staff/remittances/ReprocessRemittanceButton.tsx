'use client';

import { useState } from 'react';
import { reprocessRemittanceAction } from './actions';

/**
 * Re-pull this remittance from the Home Depot email and correct it (fixes the
 * amounts the old Google Apps Script shuffled). Deletes the stored record and
 * re-ingests the original PDF with the accurate parser, then emails the fixed
 * report. On success the action redirects to the list.
 */
export function ReprocessRemittanceButton({ id, docNumber }: { id: string; docNumber: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async () => {
        setBusy(true);
        setError(null);
        const res = await reprocessRemittanceAction(id); // redirects on success
        if (res?.error) setError(res.error);
        setBusy(false);
      }}
      onSubmit={(e) => {
        if (!confirm(`Re-pull document ${docNumber ?? '(manual)'} from the Home Depot email and fix the amounts? Deals already funded stay funded; the recorded amounts and the emailed report are corrected.`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" disabled={busy || !docNumber} className="btn-secondary text-sm" title={!docNumber ? 'Only auto-pulled remittances (with an HD document number) can be re-pulled.' : undefined}>
        {busy ? 'Re-pulling…' : 'Re-pull & fix from HD email'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  );
}

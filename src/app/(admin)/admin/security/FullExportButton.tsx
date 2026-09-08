'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

// Super-Admin-only full customer-data export. Confirms first (it produces a file
// full of decrypted PII), then navigates to the download route. The server route
// re-checks Super Admin and audit-logs the export.
export function FullExportButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  function download() {
    setBusy(true);
    // A GET that returns a CSV attachment — navigating triggers the download.
    window.location.href = '/api/admin/full-export';
    // The page doesn't unload (it's a download), so clear the state shortly after.
    window.setTimeout(() => { setBusy(false); setConfirming(false); }, 4000);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
      >
        <Download size={16} /> Export all customer data (CSV)
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">
        This downloads every customer’s full details — including decrypted SIN, date of birth, address,
        banking and ID numbers — into one CSV. The export is recorded in the audit log. Store the file
        securely and delete it when you’re done.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? 'Preparing…' : 'Yes, download everything'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

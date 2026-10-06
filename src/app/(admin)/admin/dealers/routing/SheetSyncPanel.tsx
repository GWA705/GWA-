'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  backupRoutingToSheetAction,
  previewRoutingFromSheetAction,
  applyRoutingFromSheetAction,
} from '../../../actions';

type Change = { kind: string; text: string };

export function SheetSyncPanel({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<Change[] | null>(null);

  function backup() {
    setMsg(null); setPreview(null);
    startTransition(async () => {
      const res = await backupRoutingToSheetAction();
      setMsg({ ok: !res.error, text: res.error || res.message || 'Backed up.' });
    });
  }

  function doPreview() {
    setMsg(null);
    startTransition(async () => {
      const res = await previewRoutingFromSheetAction();
      if (res.error) { setMsg({ ok: false, text: res.error }); setPreview(null); return; }
      setPreview(res.changes ?? []);
      if ((res.changes ?? []).length === 0) setMsg({ ok: true, text: 'The sheet matches the portal — nothing to apply.' });
    });
  }

  function apply() {
    startTransition(async () => {
      const res = await applyRoutingFromSheetAction();
      setMsg({ ok: !res.error, text: res.error || res.message || 'Applied.' });
      setPreview(null);
      if (!res.error) router.refresh();
    });
  }

  const dot = (kind: string) =>
    kind === 'add' ? 'bg-green-500' : kind === 'move' ? 'bg-blue-500' : kind === 'deactivate' ? 'bg-amber-500' : 'bg-gray-400';

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-gray-900">Google Sheet backup &amp; control</h2>
      <p className="mt-1 text-sm text-gray-500">
        The portal is the live system; the sheet is your backup and an editable control surface. Back up the current
        routing, or edit the sheet and pull your changes in — you’ll review every change before anything applies.
      </p>

      {!configured ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          The routing sheet isn’t connected yet. To finish setup: a sheet is created in your Drive, shared with the
          portal’s service account, and <code className="rounded bg-amber-100 px-1">MAPPING_SHEET_ID</code> is set on the
          server. Ask Claude to complete this — it’s a two-click share plus one setting.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={backup} disabled={pending} className="btn-secondary text-sm disabled:opacity-60">
              {pending ? 'Working…' : 'Back up to sheet'}
            </button>
            <button type="button" onClick={doPreview} disabled={pending} className="btn-secondary text-sm disabled:opacity-60">
              {pending ? 'Working…' : 'Pull from sheet (preview)'}
            </button>
          </div>

          {preview && preview.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3">
              <div className="mb-2 text-sm font-medium text-gray-800">{preview.length} change{preview.length === 1 ? '' : 's'} the sheet would make:</div>
              <ul className="space-y-1 text-sm">
                {preview.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${dot(c.kind)}`} aria-hidden />
                    <span className="text-gray-700">{c.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={apply} disabled={pending} className="btn-primary text-sm disabled:opacity-60">
                  Apply {preview.length} change{preview.length === 1 ? '' : 's'}
                </button>
                <button type="button" onClick={() => setPreview(null)} disabled={pending} className="text-sm text-gray-500 hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {msg && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${msg.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {msg.text}
        </div>
      )}
    </section>
  );
}

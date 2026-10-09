'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { syncZoomNowAction, setZoomRecordingStatusAction, updateZoomRecordingAction } from '@/app/(admin)/actions';
import type { ActionState } from '@/app/(admin)/actions';

export interface ZoomRow {
  id: string;
  topic: string;
  title: string;
  description: string;
  dateLabel: string;
  durationMin: number;
  sizeLabel: string;
  shareUrl: string;
  passcode: string;
  status: string;
}

function fmtDuration(min: number): string {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function ZoomSyncBar({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="text-sm text-gray-600">
        Recordings sync on a schedule. Use <span className="font-medium">Sync now</span> to pull the latest immediately.
      </div>
      <div className="flex items-center gap-3">
        {msg && <span className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
        <button
          type="button"
          disabled={!configured || pending}
          onClick={() => start(async () => {
            const r = await syncZoomNowAction();
            setMsg({ ok: !!r.ok, text: r.ok ? (r.message ?? 'Synced.') : (r.error ?? 'Failed.') });
            router.refresh();
          })}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {pending ? 'Syncing…' : '↻ Sync now'}
        </button>
      </div>
    </div>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-secondary text-xs" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>;
}

export function ZoomAdminRow({ row }: { row: ZoomRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useFormState(updateZoomRecordingAction, {} as ActionState);

  function setStatus(status: string) {
    start(async () => { await setZoomRecordingStatusAction(row.id, status); router.refresh(); });
  }

  // Close the editor once a save succeeds.
  useEffect(() => {
    if (editState.ok) { setEditing(false); router.refresh(); }
  }, [editState, router]);

  return (
    <li className="rounded-lg border border-gray-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{row.title || row.topic}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            🗓 {row.dateLabel}{row.durationMin ? ` · ⏱ ${fmtDuration(row.durationMin)}` : ''}{row.sizeLabel ? ` · ${row.sizeLabel}` : ''}
            {row.passcode ? ' · 🔑 passcode set' : ' · no passcode'}
          </div>
          {row.title && <div className="mt-0.5 text-xs text-gray-400">Zoom topic: {row.topic}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={row.shareUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sky-600 hover:underline">Watch ↗</a>
          <button type="button" onClick={() => setEditing((e) => !e)} className="text-xs font-medium text-gray-600 hover:underline">{editing ? 'Close' : 'Edit'}</button>
          {row.status !== 'PUBLISHED' && (
            <button type="button" disabled={pending} onClick={() => setStatus('PUBLISHED')} className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">Publish</button>
          )}
          {row.status === 'PUBLISHED' && (
            <button type="button" disabled={pending} onClick={() => setStatus('HIDDEN')} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Unpublish</button>
          )}
          {row.status === 'PENDING' && (
            <button type="button" disabled={pending} onClick={() => setStatus('HIDDEN')} className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">Hide</button>
          )}
          {row.status === 'HIDDEN' && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Hidden</span>
          )}
        </div>
      </div>

      {editing && (
        <form action={editAction} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <input type="hidden" name="id" value={row.id} />
          {editState.error && <p className="text-xs text-red-600">{editState.error}</p>}
          <label className="block">
            <span className="label">Title shown to dealers</span>
            <input name="title" defaultValue={row.title} placeholder={row.topic} className="input" autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Description (optional)</span>
            <textarea name="description" defaultValue={row.description} rows={2} className="input" />
          </label>
          <label className="block">
            <span className="label">Passcode</span>
            <input name="passcode" defaultValue={row.passcode} placeholder="Zoom recording passcode (if any)" className="input" autoComplete="off" />
          </label>
          <div className="flex justify-end"><SaveBtn /></div>
        </form>
      )}
    </li>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  syncZoomNowAction,
  setZoomRecordingStatusAction,
  updateZoomRecordingAction,
  createManualLinkRecordingAction,
  createManualFileRecordingAction,
  deleteZoomRecordingAction,
} from '@/app/(admin)/actions';
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
  source: string;
  hasFile: boolean;
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
  function remove() {
    if (!window.confirm('Delete this recording permanently? If it was an uploaded video, the file is removed too.')) return;
    start(async () => { await deleteZoomRecordingAction(row.id); router.refresh(); });
  }

  const watchHref = row.hasFile ? `/api/recordings/${row.id}/file` : row.shareUrl;

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
            {row.source === 'MANUAL' && (row.hasFile ? ' · 📤 uploaded file' : ' · 🔗 manual link')}
          </div>
          {row.title && row.source !== 'MANUAL' && <div className="mt-0.5 text-xs text-gray-400">Zoom topic: {row.topic}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {watchHref && <a href={watchHref} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sky-600 hover:underline">Watch ↗</a>}
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
          {row.source === 'MANUAL' && (
            <button type="button" disabled={pending} onClick={remove} className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">Delete</button>
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

function AddBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary text-sm" disabled={pending}>{pending ? 'Adding…' : label}</button>;
}

/**
 * Add a recording that isn't in Zoom's cloud — either paste a share link, or
 * upload a video file (which goes straight to S3 via a presigned PUT, so large
 * files don't pass through the server). Both land in "To review" as PENDING.
 */
export function ManualAddCard({ canUpload }: { canUpload: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'link' | 'file'>('link');

  // Link mode — a plain server action.
  const [linkState, linkAction] = useFormState(createManualLinkRecordingAction, {} as ActionState);
  const linkFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (linkState.ok) { linkFormRef.current?.reset(); router.refresh(); }
  }, [linkState, router]);

  // File mode — presign, PUT to S3 with progress, then record the row.
  const fileFormRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileMsg, setFileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('video');
    const title = String(fd.get('title') || '').trim();
    const date = String(fd.get('date') || '').trim();
    if (!(file instanceof File) || file.size === 0) { setFileMsg({ ok: false, text: 'Choose a video file.' }); return; }
    if (!title) { setFileMsg({ ok: false, text: 'Enter a title.' }); return; }
    if (!date) { setFileMsg({ ok: false, text: 'Enter a date.' }); return; }

    setUploading(true); setProgress(0); setFileMsg(null);
    try {
      // 1) Ask the server for a presigned PUT URL.
      const presignRes = await fetch('/api/admin/recordings/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error || 'Could not start the upload.');

      // 2) Upload the bytes straight to S3 (with progress).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presign.url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'));
        xhr.send(file);
      });

      // 3) Record the row pointing at the uploaded file.
      const save = new FormData();
      save.set('title', title);
      save.set('date', date);
      save.set('description', String(fd.get('description') || ''));
      save.set('passcode', String(fd.get('passcode') || ''));
      save.set('fileKey', presign.key);
      save.set('fileType', file.type);
      save.set('sizeBytes', String(file.size));
      const r = await createManualFileRecordingAction({} as ActionState, save);
      if (r.error) throw new Error(r.error);
      setFileMsg({ ok: true, text: r.message || 'Uploaded.' });
      form.reset(); setProgress(0);
      router.refresh();
    } catch (err) {
      setFileMsg({ ok: false, text: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900">Add a recording manually</h2>
      <p className="mt-1 text-xs text-gray-500">
        For recordings that aren’t in Zoom’s cloud (e.g. ones saved to a computer). Paste a share link, or upload the
        video file. It lands in <em>To review</em> — publish it to show dealers.
      </p>

      <div className="mt-3 inline-flex rounded-md border border-gray-200 p-0.5 text-xs">
        <button type="button" onClick={() => setMode('link')} className={`rounded px-3 py-1 font-medium ${mode === 'link' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>Paste a link</button>
        <button type="button" onClick={() => setMode('file')} className={`rounded px-3 py-1 font-medium ${mode === 'file' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>Upload a file</button>
      </div>

      {mode === 'link' ? (
        <form ref={linkFormRef} action={linkAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {linkState.error && <p className="sm:col-span-2 text-xs text-red-600">{linkState.error}</p>}
          {linkState.ok && linkState.message && <p className="sm:col-span-2 text-xs text-green-700">{linkState.message}</p>}
          <label className="block"><span className="label">Title</span><input name="title" required className="input" autoComplete="off" /></label>
          <label className="block"><span className="label">Date</span><input name="date" type="date" required className="input" /></label>
          <label className="block sm:col-span-2"><span className="label">Share link</span><input name="shareUrl" type="url" required placeholder="https://… (Zoom, Google Drive, YouTube unlisted, …)" className="input" autoComplete="off" /></label>
          <label className="block"><span className="label">Passcode (optional)</span><input name="passcode" className="input" autoComplete="off" /></label>
          <label className="block"><span className="label">Description (optional)</span><input name="description" className="input" /></label>
          <div className="sm:col-span-2 flex justify-end"><AddBtn label="Add recording" /></div>
        </form>
      ) : (
        <form ref={fileFormRef} onSubmit={onUpload} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!canUpload && <p className="sm:col-span-2 rounded bg-amber-50 p-2 text-xs text-amber-800">File storage (S3) isn’t configured here, so uploads are off — paste a link instead.</p>}
          {fileMsg && <p className={`sm:col-span-2 text-xs ${fileMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{fileMsg.text}</p>}
          <label className="block"><span className="label">Title</span><input name="title" required className="input" autoComplete="off" /></label>
          <label className="block"><span className="label">Date</span><input name="date" type="date" required className="input" /></label>
          <label className="block sm:col-span-2"><span className="label">Video file</span><input name="video" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo" required className="block w-full text-sm" /></label>
          <label className="block"><span className="label">Passcode (optional)</span><input name="passcode" className="input" autoComplete="off" /></label>
          <label className="block"><span className="label">Description (optional)</span><input name="description" className="input" /></label>
          {uploading && (
            <div className="sm:col-span-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-500">Uploading… {progress}% — keep this tab open.</p>
            </div>
          )}
          <p className="sm:col-span-2 text-xs text-gray-400">MP4, MOV, WEBM, MKV or AVI, up to 3 GB. Large files take a while.</p>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary text-sm disabled:opacity-50" disabled={uploading || !canUpload}>{uploading ? 'Uploading…' : 'Upload recording'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

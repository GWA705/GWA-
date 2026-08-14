'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadCallRecordingAction, deleteCallRecordingAction } from '@/app/(staff)/actions';

export interface RecordingView {
  id: string;
  source: string;
  direction: string | null;
  startedAt: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  mime: string;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDur(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Call recordings attached to this deal — auto-pulled from Bell Total Connect
 * (Dubber) by phone match, or uploaded by hand. Plays inline; staff can remove.
 */
export function CallRecordings({ applicationId, recordings }: { applicationId: string; recordings: RecordingView[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set('applicationId', applicationId);
    fd.set('file', file);
    start(async () => {
      const res = await uploadCallRecordingAction(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm('Remove this recording? This deletes the stored audio.')) return;
    start(async () => {
      const res = await deleteCallRecordingAction(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Call recordings</h3>
      <p className="mb-3 text-xs text-gray-500">
        Recordings matched to this customer by phone (from Bell Total Connect), plus any you upload.
      </p>

      {recordings.length === 0 ? (
        <p className="mb-3 rounded-md bg-gray-50 p-3 text-sm text-gray-500">No recordings for this deal yet.</p>
      ) : (
        <ul className="mb-3 space-y-3">
          {recordings.map((r) => (
            <li key={r.id} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${r.source === 'manual' ? 'bg-gray-100 text-gray-600' : 'bg-sky-100 text-sky-700'}`}>
                  {r.source === 'manual' ? 'Uploaded' : 'Bell'}
                </span>
                {r.direction && <span className="capitalize">{r.direction}</span>}
                {r.startedAt && <span>· {fmtWhen(r.startedAt)}</span>}
                {r.durationSec ? <span>· {fmtDur(r.durationSec)}</span> : null}
                <button type="button" onClick={() => remove(r.id)} className="ml-auto text-gray-400 hover:text-red-500" title="Remove">✕</button>
              </div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" className="w-full" src={`/api/call-recordings/${r.id}/audio`} />
              <div className="mt-1 text-right">
                <a href={`/api/call-recordings/${r.id}/audio?download=1`} className="text-xs font-medium text-sky-600 hover:underline">Download</a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <input ref={fileRef} type="file" accept="audio/*" className="block max-w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
        <button type="button" onClick={upload} disabled={pending} className="btn-secondary text-xs disabled:opacity-50">
          {pending ? 'Uploading…' : 'Upload recording'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

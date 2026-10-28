'use client';

import { useRef, useState } from 'react';
import { saveIdTagCardAction } from '../actions';

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const lab = 'mb-1 block text-xs font-semibold text-slate-600';

type ReadState = { kind: 'idle' | 'reading' | 'ok' | 'fail'; msg?: string };

/**
 * The Entuitive-card form, with auto-fill: when the reviewer picks the finished
 * card file, we read the valid-until, badge # and status off it (Claude vision)
 * and drop them into the fields. Everything stays editable — the reviewer
 * confirms, then Saves (which also stores the file). Uncontrolled inputs (refs)
 * so a save round-trip never fights React state.
 */
export function CardForm({
  id, defaultValidUntil, defaultBadge, defaultStatus, hasCard,
}: {
  id: string;
  defaultValidUntil: string;
  defaultBadge: string;
  defaultStatus: string;
  hasCard: boolean;
}) {
  const validRef = useRef<HTMLInputElement>(null);
  const badgeRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLInputElement>(null);
  const [read, setRead] = useState<ReadState>({ kind: 'idle' });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRead({ kind: 'reading' });
    try {
      const fd = new FormData();
      fd.append('card', file);
      const res = await fetch('/api/id-tags/parse-card', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { validUntil: string | null; badgeNumber: string | null; entuitiveStatus: string | null };
      const filled: string[] = [];
      if (data.validUntil && validRef.current) { validRef.current.value = data.validUntil; filled.push('valid-until'); }
      if (data.badgeNumber && badgeRef.current) { badgeRef.current.value = data.badgeNumber; filled.push('badge #'); }
      if (data.entuitiveStatus && statusRef.current) { statusRef.current.value = data.entuitiveStatus; filled.push('status'); }
      setRead(filled.length
        ? { kind: 'ok', msg: `Read from the card: ${filled.join(', ')}. Check it, then Save.` }
        : { kind: 'fail', msg: 'Couldn’t read the details off this card — please enter them by hand.' });
    } catch {
      setRead({ kind: 'fail', msg: 'Couldn’t read the card — please enter the details by hand.' });
    }
  }

  return (
    <form action={saveIdTagCardAction} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={lab}>Valid until</span>
          <input ref={validRef} name="validUntil" type="date" defaultValue={defaultValidUntil} className={inp} /></label>
        <label className="block"><span className={lab}>Badge #</span>
          <input ref={badgeRef} name="badgeNumber" defaultValue={defaultBadge} placeholder="1043317" className={inp} /></label>
      </div>
      <label className="block"><span className={lab}>Entuitive status</span>
        <input ref={statusRef} name="entuitiveStatus" defaultValue={defaultStatus} placeholder="Approved / Approuvé" className={inp} /></label>
      <label className="block"><span className={lab}>Upload finished QR card (front + back)</span>
        <input name="card" type="file" accept="application/pdf,image/*" onChange={onPick}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700" />
        <span className="mt-1 block text-xs text-slate-400">Pick the card and we’ll read the valid-until and badge # off it for you.</span>
        {hasCard && <a href={`/api/id-tags/${id}/card`} className="mt-1 inline-block text-xs font-semibold text-brand-600 hover:underline">Current card uploaded — download</a>}
      </label>
      {read.kind === 'reading' && <p className="text-xs font-medium text-slate-500">Reading the card…</p>}
      {read.kind === 'ok' && <p className="text-xs font-medium text-green-700">✓ {read.msg}</p>}
      {read.kind === 'fail' && <p className="text-xs font-medium text-amber-700">{read.msg}</p>}
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save card</button>
    </form>
  );
}

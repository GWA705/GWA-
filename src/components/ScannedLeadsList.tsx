'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setScannedLeadStatusAction, deleteScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';

export interface ScannedLeadRow {
  id: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  storeNumber: string | null;
  collectedOn: string | null;
  ownsHome: string | null;
  waterSource: string | null;
  waterQuality: string | null;
  conditions: string[];
  waterNotes: string | null;
  note: string | null;
  generatorName: string | null;
  confidence: number | null;
  status: string;
  hasPhoto: boolean;
  scannedByName: string | null;
  officeName?: string | null; // staff view only
  createdAt: string; // ISO
}

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-green-100 text-green-800',
  NO_GOOD: 'bg-gray-200 text-gray-600',
};
const STATUS_LABEL: Record<string, string> = { NEW: 'New', CONTACTED: 'Contacted', NO_GOOD: 'No good' };

function Row({ lead, showOffice }: { lead: ScannedLeadRow; showOffice: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const addr = [lead.address, [lead.city, lead.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const water = [lead.waterSource, lead.waterQuality && `${lead.waterQuality} quality`, lead.conditions.length ? lead.conditions.join(', ') : null]
    .filter(Boolean).join(' · ');

  function setStatus(status: string) {
    start(async () => {
      const r = await setScannedLeadStatusAction(lead.id, status);
      if (r.error) setErr(r.error); else router.refresh();
    });
  }
  function remove() {
    if (!confirm(`Delete the scanned lead for ${lead.customerName || 'this card'}?`)) return;
    start(async () => {
      const r = await deleteScannedLeadAction(lead.id);
      if (r.error) setErr(r.error); else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{lead.customerName || '(no name)'}</div>
          <div className="text-sm text-gray-600">
            {lead.phone ? <a href={`tel:${lead.phone}`} className="text-brand-700 hover:underline">{lead.phone}</a> : '—'}
          </div>
        </div>
        <span className={`badge shrink-0 ${STATUS_STYLE[lead.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
      </div>

      <dl className="mt-2 space-y-0.5 text-sm text-gray-600">
        {addr && <div>{addr}</div>}
        {(lead.storeNumber || lead.collectedOn) && (
          <div className="text-xs text-gray-500">
            {lead.storeNumber && <>Store {lead.storeNumber}</>}{lead.storeNumber && lead.collectedOn ? ' · ' : ''}{lead.collectedOn && <>collected {lead.collectedOn}</>}
          </div>
        )}
        {water && <div className="text-xs text-gray-500">{water}</div>}
        {lead.ownsHome && lead.ownsHome !== 'UNKNOWN' && <div className="text-xs text-gray-500">Home: {lead.ownsHome === 'OWN' ? 'owns' : lead.ownsHome === 'RENT' ? 'rents' : 'with parents'}</div>}
        {lead.waterNotes && <div className="text-xs italic text-gray-500">“{lead.waterNotes}”</div>}
        {lead.note && <div className="text-xs text-gray-500">Note: {lead.note}</div>}
        {showOffice && <div className="text-xs text-gray-400">Office: {lead.officeName || 'Unassigned'}</div>}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        {lead.hasPhoto && (
          <a href={`/api/leads/scanned/${lead.id}/photo?size=full`} target="_blank" rel="noreferrer" className="rounded-md border border-gray-200 px-2 py-1 font-medium text-brand-700 hover:bg-gray-50">
            View photo
          </a>
        )}
        <label className="sr-only" htmlFor={`st_${lead.id}`}>Status</label>
        <select id={`st_${lead.id}`} value={lead.status} onChange={(e) => setStatus(e.target.value)} disabled={pending}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs">
          <option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="NO_GOOD">No good</option>
        </select>
        <button type="button" onClick={remove} disabled={pending} className="ml-auto text-gray-400 hover:text-red-600">Delete</button>
      </div>
      {lead.confidence != null && <div className="mt-1 text-[11px] text-gray-400">Scanned {lead.confidence}% confidence{lead.scannedByName ? ` · by ${lead.scannedByName}` : ''}</div>}
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
    </div>
  );
}

export function ScannedLeadsList({ leads, showOffice = false }: { leads: ScannedLeadRow[]; showOffice?: boolean }) {
  if (leads.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">No scanned lead cards yet. Use “Add a lead card” above to scan one.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {leads.map((l) => <Row key={l.id} lead={l} showOffice={showOffice} />)}
    </div>
  );
}

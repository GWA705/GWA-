'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { setScannedLeadStatusAction, deleteScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';
import { LeadCallTracker } from './LeadCallTracker';
import type { LeadCallRow } from '@/lib/leadCalls';
import { scannedLeadKey } from '@/lib/scannedLeadKey';

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
  householdSize: string | null;
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

const CHIP: Record<string, string> = {
  grey: 'bg-gray-100 text-gray-600', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700',
  teal: 'bg-teal-100 text-teal-800', green: 'bg-emerald-100 text-emerald-800', violet: 'bg-violet-100 text-violet-800',
};
const STRIPE: Record<string, string> = {
  grey: 'border-gray-300', amber: 'border-amber-500', red: 'border-red-500',
  teal: 'border-teal-500', green: 'border-emerald-500', violet: 'border-violet-500',
};

/**
 * Coarse status group for a mail-in card, for the workspace's filter chips and
 * sorting: new / working / spoke / booked / sold / nogood. Derived from the
 * logged calls plus the card's own No-good status.
 */
export function scannedGroupKey(status: string, calls: { outcome: string }[]): string {
  if (status === 'NO_GOOD') return 'nogood';
  if (calls.length === 0) return 'new';
  const last = calls[calls.length - 1].outcome;
  if (last === 'SOLD') return 'sold';
  if (last === 'BOOKED') return 'booked';
  if (last === 'SPOKE') return 'spoke';
  if (last === 'NOT_INTERESTED') return 'nogood';
  return 'working'; // LEFT_MESSAGE / NO_ANSWER / notes
}

// Same status shape the HD lead rows use, derived from the logged calls (plus a
// No-good override from the card's own status).
function deriveBadge(status: string, calls: { outcome: string }[]): { tone: string; label: string } {
  if (status === 'NO_GOOD') return { tone: 'red', label: 'No good' };
  if (calls.length === 0) return { tone: 'grey', label: status === 'CONTACTED' ? 'Contacted' : 'New' };
  const noAns = calls.filter((c) => c.outcome === 'NO_ANSWER').length;
  const last = calls[calls.length - 1].outcome;
  switch (last) {
    case 'SOLD': return { tone: 'violet', label: 'Sold' };
    case 'BOOKED': return { tone: 'green', label: 'Booked' };
    case 'NOT_INTERESTED': return { tone: 'grey', label: 'No interest' };
    case 'SPOKE': return { tone: 'teal', label: 'Spoke' };
    case 'LEFT_MESSAGE': return { tone: 'amber', label: 'Msg left' };
    case 'NO_ANSWER': return noAns >= 2 ? { tone: 'red', label: `No answer ×${noAns}` } : { tone: 'amber', label: 'No answer' };
    default: return { tone: 'grey', label: 'Note' };
  }
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

// In-app photo viewer with a proper close button (opening the photo in a new tab
// left mobile users stuck with no way back).
function PhotoLightbox({ id, onClose }: { id: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <button type="button" onClick={onClose} aria-label="Close photo"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/leads/scanned/${id}/photo?size=full`} alt="Lead card"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl" />
      <a href={`/api/leads/scanned/${id}/photo?size=full`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/25">
        Open in new tab
      </a>
    </div>
  );
}

export function ScannedLeadRowItem({ lead, calls, showOffice, typeTag }: { lead: ScannedLeadRow; calls: LeadCallRow[]; showOffice: boolean; typeTag?: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const addr = [lead.address, [lead.city, lead.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const water = [lead.waterSource, lead.waterQuality && `${lead.waterQuality} quality`, lead.conditions.length ? lead.conditions.join(', ') : null]
    .filter(Boolean).join(' · ');
  const badge = deriveBadge(lead.status, calls);
  const sub = [lead.storeNumber && `Store ${lead.storeNumber}`, lead.city, lead.collectedOn && `collected ${lead.collectedOn}`].filter(Boolean).join(' · ');

  function setStatus(status: string) {
    start(async () => {
      const r = await setScannedLeadStatusAction(lead.id, status);
      if (r.error) setErr(r.error); else router.refresh();
    });
  }
  function remove() {
    if (!confirm(`Delete this HD Mail In Test for ${lead.customerName || 'this card'}?`)) return;
    start(async () => {
      const r = await deleteScannedLeadAction(lead.id);
      if (r.error) setErr(r.error); else router.refresh();
    });
  }

  return (
    <details className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm open:shadow-sm">
      <summary className={`flex cursor-pointer list-none items-center gap-3 border-l-[6px] ${STRIPE[badge.tone]} rounded-l-xl px-4 py-3 hover:bg-gray-50 group-open:bg-gray-50/60`}>
        {typeTag}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-gray-900">{lead.customerName ? titleCase(lead.customerName) : '(no name)'}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{sub || 'Mail-in test card'}</span>
        </span>
        <span className="hidden shrink-0 text-xs text-gray-500 md:inline">{lead.phone}</span>
        <span className={`badge shrink-0 ${CHIP[badge.tone]}`}>{badge.label}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[11px] text-gray-400 transition group-hover:border-gray-300 group-hover:text-gray-600 group-open:rotate-180" aria-hidden>▾</span>
      </summary>

      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="mb-2 text-sm text-gray-700">
          {lead.phone ? <a href={`tel:${lead.phone}`} className="font-semibold text-brand-700 hover:underline">📞 {lead.phone}</a> : <span className="text-gray-400">No phone on card</span>}
        </div>
        <dl className="space-y-0.5 text-sm text-gray-600">
          {addr && <div>{addr}</div>}
          {water && <div className="text-xs text-gray-500">{water}</div>}
          {(lead.ownsHome && lead.ownsHome !== 'UNKNOWN' || lead.householdSize) && (
            <div className="text-xs text-gray-500">
              {lead.ownsHome && lead.ownsHome !== 'UNKNOWN' && <>Home: {lead.ownsHome === 'OWN' ? 'owns' : lead.ownsHome === 'RENT' ? 'rents' : 'with parents'}</>}
              {lead.ownsHome && lead.ownsHome !== 'UNKNOWN' && lead.householdSize ? ' · ' : ''}
              {lead.householdSize && <>{lead.householdSize} in household</>}
            </div>
          )}
          {lead.generatorName && <div className="text-xs text-gray-500">Collected by: {lead.generatorName}</div>}
          {lead.waterNotes && <div className="text-xs italic text-gray-500">“{lead.waterNotes}”</div>}
          {lead.note && <div className="text-xs text-gray-500">Note: {lead.note}</div>}
          {showOffice && <div className="text-xs text-gray-400">Office: {lead.officeName || 'Unassigned'}</div>}
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {lead.hasPhoto && (
            <button type="button" onClick={() => setPhotoOpen(true)} className="rounded-md border border-gray-200 px-2 py-1 font-medium text-brand-700 hover:bg-gray-50">
              View photo
            </button>
          )}
          <label className="sr-only" htmlFor={`st_${lead.id}`}>Card status</label>
          <select id={`st_${lead.id}`} value={lead.status} onChange={(e) => setStatus(e.target.value)} disabled={pending}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs">
            <option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="NO_GOOD">No good</option>
          </select>
          <button type="button" onClick={remove} disabled={pending} className="ml-auto text-gray-400 hover:text-red-600">Delete</button>
        </div>
        {lead.confidence != null && <div className="mt-1 text-[11px] text-gray-400">Scanned {lead.confidence}% confidence{lead.scannedByName ? ` · by ${lead.scannedByName}` : ''}</div>}
        {err && <div className="mt-1 text-xs text-red-600">{err}</div>}

        {/* Call functions — same tracker the Home Depot leads use. */}
        <LeadCallTracker leadKey={scannedLeadKey(lead.id)} initial={calls} />
      </div>

      {photoOpen && <PhotoLightbox id={lead.id} onClose={() => setPhotoOpen(false)} />}
    </details>
  );
}

export function ScannedLeadsList({
  leads,
  callsByKey = {},
  showOffice = false,
}: {
  leads: ScannedLeadRow[];
  callsByKey?: Record<string, LeadCallRow[]>;
  showOffice?: boolean;
}) {
  if (leads.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">No HD Mail In Test cards yet. Use “Add HD Mail In Test” above to scan one.</p>;
  }
  return (
    <div className="space-y-2">
      {leads.map((l) => <ScannedLeadRowItem key={l.id} lead={l} calls={callsByKey[scannedLeadKey(l.id)] ?? []} showOffice={showOffice} />)}
    </div>
  );
}

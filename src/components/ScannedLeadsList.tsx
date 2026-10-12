'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';
import { setScannedLeadStatusAction, deleteScannedLeadAction } from '@/app/(dealer)/dealer/leads/scanActions';
import { LeadCallTracker } from './LeadCallTracker';
import { ScannedLeadEditForm } from './ScannedLeadEditForm';
import type { LeadCallRow } from '@/lib/leadCalls';
import { scannedLeadKey } from '@/lib/scannedLeadKey';
import { leadSla } from '@/lib/leadSla';

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
  bookingStatus?: string | null; // booking system's status for this lead, mirrored back
  // Customer self-booking (Phase 2) — a request the customer made themselves.
  bookingRequestedAt?: string | null; // ISO
  bookingCallNow?: boolean;
  bookingPreferredDay?: string | null;
  bookingWindow?: string | null;
  bookingNote?: string | null;
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

// Same status shape the HD lead rows use, derived from the logged calls (plus a
// No-good override from the card's own status).
function deriveBadge(status: string, calls: { outcome: string }[], t: TFunction): { tone: string; label: string } {
  if (status === 'NO_GOOD') return { tone: 'red', label: t('leadUi.status.nogood') };
  if (calls.length === 0) return { tone: 'grey', label: status === 'CONTACTED' ? t('leadUi.status.contacted') : t('leadUi.status.new') };
  const noAns = calls.filter((c) => c.outcome === 'NO_ANSWER').length;
  const last = calls[calls.length - 1].outcome;
  switch (last) {
    case 'SOLD': return { tone: 'violet', label: t('leadUi.status.sold') };
    case 'BOOKED': return { tone: 'green', label: t('leadUi.status.booked') };
    case 'NOT_INTERESTED': return { tone: 'grey', label: t('leadUi.status.noInterest') };
    case 'SPOKE': return { tone: 'teal', label: t('leadUi.status.spoke') };
    case 'LEFT_MESSAGE': return { tone: 'amber', label: t('leadUi.callBadge.msgLeft') };
    case 'NO_ANSWER': return noAns >= 2 ? { tone: 'red', label: t('leadUi.callBadge.noAnswerN', { n: noAns }) } : { tone: 'amber', label: t('leadUi.callBadge.noAnswer') };
    default: return { tone: 'grey', label: t('leadUi.callBadge.note') };
  }
}

// The booking system's status for this lead, mirrored back so the office sees
// what the bookers did. A friendly label + tone; unknown values pass through.
// The booking system's status → {tone, translation-key}. The code (NEW, SOLD…)
// is stable; the label is resolved with t() at render.
const BOOKING_META: Record<string, { tone: string; key: string }> = {
  NEW: { tone: 'grey', key: 'leadUi.booking.new' },
  WORKING: { tone: 'amber', key: 'leadUi.booking.calling' },
  CALLBACK: { tone: 'amber', key: 'leadUi.booking.callback' },
  BOOKED: { tone: 'green', key: 'leadUi.booking.booked' },
  CONFIRMED: { tone: 'green', key: 'leadUi.booking.confirmed' },
  DISPATCHED: { tone: 'teal', key: 'leadUi.booking.dispatched' },
  SOLD: { tone: 'violet', key: 'leadUi.booking.sold' },
  NOT_SOLD: { tone: 'grey', key: 'leadUi.booking.notSold' },
  NO_SHOW: { tone: 'grey', key: 'leadUi.booking.noShow' },
  NOT_QUALIFIED: { tone: 'grey', key: 'leadUi.booking.notQualified' },
  CANCELLED: { tone: 'grey', key: 'leadUi.booking.cancelled' },
  DEAD: { tone: 'red', key: 'leadUi.booking.dead' },
};
function bookingBadge(s: string | null | undefined, t: TFunction): { tone: string; label: string } | null {
  if (!s) return null;
  const meta = BOOKING_META[s];
  return meta
    ? { tone: meta.tone, label: t(meta.key) }
    : { tone: 'grey', label: t('leadUi.booking.other', { status: s.toLowerCase() }) };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

// Stored data values → translation keys (the stored value stays English).
const WATER_SOURCE_KEY: Record<string, string> = {
  City: 'leadUi.waterSource.city', Well: 'leadUi.waterSource.well',
  'Community Well': 'leadUi.waterSource.communityWell', Other: 'leadUi.waterSource.other',
};
const WATER_QUALITY_KEY: Record<string, string> = {
  Excellent: 'leadUi.waterQuality.excellent', Good: 'leadUi.waterQuality.good',
  Fair: 'leadUi.waterQuality.fair', Poor: 'leadUi.waterQuality.poor',
};
const CONDITION_KEY: Record<string, string> = {
  Taste: 'leadUi.condition.taste', Odors: 'leadUi.condition.odors',
  'Scale build up': 'leadUi.condition.scaleBuildUp', Stains: 'leadUi.condition.stains',
};

// Customer self-booking (Phase 2). A short label for what the customer requested.
const WIN_KEY: Record<string, string> = { MORNING: 'leadUi.window.am', AFTERNOON: 'leadUi.window.pm', EVENING: 'leadUi.window.eve', ANYTIME: 'leadUi.window.any' };
function selfBookLabel(day: string | null | undefined, win: string | null | undefined, t: TFunction): string {
  let d = '';
  if (day) {
    const dt = new Date(`${day}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) d = dt.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const w = win ? (WIN_KEY[win] ? t(WIN_KEY[win]) : win) : '';
  return [d, w].filter(Boolean).join(' · ') || t('leadUi.selfBook.aTime');
}
function selfBookBadge(lead: ScannedLeadRow, t: TFunction): { tone: string; label: string } | null {
  if (lead.bookingCallNow) return { tone: 'red', label: t('leadUi.selfBook.callAsap') };
  if (lead.bookingRequestedAt) return { tone: 'teal', label: t('leadUi.selfBook.selfBooked', { when: selfBookLabel(lead.bookingPreferredDay, lead.bookingWindow, t) }) };
  return null;
}

// In-app photo viewer with a proper close button (opening the photo in a new tab
// left mobile users stuck with no way back).
function PhotoLightbox({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
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
      <img src={`/api/leads/scanned/${id}/photo?size=full`} alt={t('leadUi.lead.cardAlt')}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl" />
      <a href={`/api/leads/scanned/${id}/photo?size=full`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/25">
        {t('leadUi.lead.openInNewTab')}
      </a>
    </div>
  );
}

export function ScannedLeadRowItem({ lead, calls, showOffice, typeTag }: { lead: ScannedLeadRow; calls: LeadCallRow[]; showOffice: boolean; typeTag?: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const addr = [lead.address, [lead.city, lead.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const sourceLabel = lead.waterSource ? (WATER_SOURCE_KEY[lead.waterSource] ? t(WATER_SOURCE_KEY[lead.waterSource]) : lead.waterSource) : null;
  const qualityLabel = lead.waterQuality
    ? t('leadUi.lead.waterQualitySummary', { quality: WATER_QUALITY_KEY[lead.waterQuality] ? t(WATER_QUALITY_KEY[lead.waterQuality]) : lead.waterQuality })
    : null;
  const conditionsLabel = lead.conditions.length
    ? lead.conditions.map((c) => (CONDITION_KEY[c] ? t(CONDITION_KEY[c]) : c)).join(', ')
    : null;
  const water = [sourceLabel, qualityLabel, conditionsLabel].filter(Boolean).join(' · ');
  const badge = deriveBadge(lead.status, calls, t);
  const bkg = bookingBadge(lead.bookingStatus, t);
  const sla = leadSla({ createdAt: lead.createdAt, status: lead.status, bookingStatus: lead.bookingStatus });
  const selfBook = selfBookBadge(lead, t);
  const sub = [lead.storeNumber && t('leadUi.lead.storeNum', { n: lead.storeNumber }), lead.city, lead.collectedOn && t('leadUi.lead.collectedPrefix', { date: lead.collectedOn })].filter(Boolean).join(' · ');

  function setStatus(status: string) {
    start(async () => {
      const r = await setScannedLeadStatusAction(lead.id, status);
      if (r.error) setErr(r.error); else router.refresh();
    });
  }
  function remove() {
    if (!confirm(t('leadUi.scan.confirmDelete', { name: lead.customerName || t('leadUi.scan.thisCard') }))) return;
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
          <span className="block truncate font-semibold text-gray-900">{lead.customerName ? titleCase(lead.customerName) : t('leadUi.lead.noName')}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{sub || t('leadUi.lead.mailInTestCard')}</span>
        </span>
        <span className="hidden shrink-0 text-xs text-gray-500 md:inline">{lead.phone}</span>
        {selfBook && <span className={`badge shrink-0 ${CHIP[selfBook.tone]}`} title={t('leadUi.selfBook.requestedTitle')}>{selfBook.label}</span>}
        {sla && <span className={`badge shrink-0 ${CHIP[sla.tone]}`} title={t('leadUi.sla.title')}>⏱ {sla.label}</span>}
        {bkg && <span className={`badge hidden shrink-0 sm:inline ${CHIP[bkg.tone]}`} title={t('leadUi.booking.title')}>{bkg.label}</span>}
        <span className={`badge shrink-0 ${CHIP[badge.tone]}`}>{badge.label}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[11px] text-gray-400 transition group-hover:border-gray-300 group-hover:text-gray-600 group-open:rotate-180" aria-hidden>▾</span>
      </summary>

      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="mb-2 text-sm text-gray-700">
          {lead.phone ? <a href={`tel:${lead.phone}`} className="font-semibold text-brand-700 hover:underline">📞 {lead.phone}</a> : <span className="text-gray-400">{t('leadUi.lead.noPhoneOnCard')}</span>}
        </div>

        {(lead.bookingRequestedAt || lead.bookingCallNow) && (
          <div className={`mb-2 rounded-lg border p-2.5 text-sm ${lead.bookingCallNow ? 'border-red-200 bg-red-50 text-red-800' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
            <div className="font-semibold">
              {lead.bookingCallNow ? t('leadUi.selfBook.callAsapLong') : t('leadUi.selfBook.customerRequested', { when: selfBookLabel(lead.bookingPreferredDay, lead.bookingWindow, t) })}
            </div>
            {lead.bookingNote && <div className="mt-0.5 text-xs italic">“{lead.bookingNote}”</div>}
            {lead.bookingRequestedAt && <div className="mt-0.5 text-[11px] opacity-75">{t('leadUi.selfBook.viaBookingLink')} · {new Date(lead.bookingRequestedAt).toLocaleString('en-CA')}</div>}
          </div>
        )}
        <dl className="space-y-0.5 text-sm text-gray-600">
          {addr && <div>{addr}</div>}
          {water && <div className="text-xs text-gray-500">{water}</div>}
          {(lead.ownsHome && lead.ownsHome !== 'UNKNOWN' || lead.householdSize) && (
            <div className="text-xs text-gray-500">
              {lead.ownsHome && lead.ownsHome !== 'UNKNOWN' && <>{t('leadUi.lead.home', { status: t(`leadUi.ownsHomeShort.${lead.ownsHome === 'OWN' ? 'owns' : lead.ownsHome === 'RENT' ? 'rents' : 'withParents'}`) })}</>}
              {lead.ownsHome && lead.ownsHome !== 'UNKNOWN' && lead.householdSize ? ' · ' : ''}
              {lead.householdSize && <>{t('leadUi.lead.inHousehold', { n: lead.householdSize })}</>}
            </div>
          )}
          {lead.generatorName && <div className="text-xs text-gray-500">{t('leadUi.lead.collectedBy', { name: lead.generatorName })}</div>}
          {lead.waterNotes && <div className="text-xs italic text-gray-500">“{lead.waterNotes}”</div>}
          {lead.note && <div className="text-xs text-gray-500">{t('leadUi.lead.note', { note: lead.note })}</div>}
          {showOffice && <div className="text-xs text-gray-400">{t('leadUi.lead.office', { name: lead.officeName || t('leadUi.lead.unassigned') })}</div>}
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {lead.hasPhoto && (
            <button type="button" onClick={() => setPhotoOpen(true)} className="rounded-md border border-gray-200 px-2 py-1 font-medium text-brand-700 hover:bg-gray-50">
              {t('leadUi.lead.viewPhoto')}
            </button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-md border border-gray-200 px-2 py-1 font-medium text-brand-700 hover:bg-gray-50">
            {editing ? t('leadUi.edit.close') : t('common.edit')}
          </button>
          <label className="sr-only" htmlFor={`st_${lead.id}`}>{t('leadUi.lead.cardStatus')}</label>
          <select id={`st_${lead.id}`} value={lead.status} onChange={(e) => setStatus(e.target.value)} disabled={pending}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs">
            <option value="NEW">{t('leadUi.status.new')}</option><option value="CONTACTED">{t('leadUi.status.contacted')}</option><option value="NO_GOOD">{t('leadUi.status.nogood')}</option>
          </select>
          <button type="button" onClick={remove} disabled={pending} className="ml-auto text-gray-400 hover:text-red-600">{t('common.delete')}</button>
        </div>
        {lead.confidence != null && <div className="mt-1 text-[11px] text-gray-400">{t('leadUi.lead.scannedConfidence', { pct: lead.confidence })}{lead.scannedByName ? ` · ${t('leadUi.lead.by', { name: lead.scannedByName })}` : ''}</div>}
        {err && <div className="mt-1 text-xs text-red-600">{err}</div>}

        {editing && <ScannedLeadEditForm lead={lead} onDone={() => setEditing(false)} />}

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
  const t = useT();
  if (leads.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">{t('leadUi.list.empty')}</p>;
  }

  // SLA roll-up — how many open leads are approaching or past the 24-48 hr call
  // promise, so bookers/dealers see at a glance if any are slipping.
  let overdue = 0;
  let dueSoon = 0;
  for (const l of leads) {
    const s = leadSla({ createdAt: l.createdAt, status: l.status, bookingStatus: l.bookingStatus });
    if (s?.state === 'OVERDUE') overdue += 1;
    else if (s?.state === 'DUE_SOON') dueSoon += 1;
  }

  return (
    <div className="space-y-2">
      {(overdue > 0 || dueSoon > 0) && (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${overdue > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className="font-semibold">{t('leadUi.sla.heading')}</span>
          {overdue > 0 && <span><strong>{overdue}</strong> {t('leadUi.sla.overdueSuffix')}</span>}
          {dueSoon > 0 && <span><strong>{dueSoon}</strong> {t('leadUi.sla.dueSoonSuffix')}</span>}
          <span className="text-xs opacity-80">{t('leadUi.sla.hint')}</span>
        </div>
      )}
      {leads.map((l) => <ScannedLeadRowItem key={l.id} lead={l} calls={callsByKey[scannedLeadKey(l.id)] ?? []} showOffice={showOffice} />)}
    </div>
  );
}

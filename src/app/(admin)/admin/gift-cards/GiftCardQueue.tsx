'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { GiftCardThread, type GiftCardNoteVM } from '@/components/GiftCardThread';
import { markGiftCardsSentAction, addStaffGiftCardNoteAction, type GiftCardAdminState } from './actions';

export interface PendingCard {
  id: string;
  dealerName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  amount: number;
  requestedAt: string; // preformatted
  requestedAtISO: string; // raw, for grouping by day
  staffUnread: boolean;
  notes: GiftCardNoteVM[];
}

const dayKeyOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
const dayLabelOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });

interface DayGroup { key: string; label: string; cards: PendingCard[] }
interface OfficeGroup { office: string; ids: string[]; total: number; days: DayGroup[] }

function MarkSentBtn({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || count === 0}>
      {pending ? 'Saving…' : `Mark ${count} sent`}
    </button>
  );
}

export function GiftCardQueue({ pending }: { pending: PendingCard[] }) {
  const [state, action] = useFormState(markGiftCardsSentAction, {} as GiftCardAdminState);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pending.map((p) => p.id)));
  const [copied, setCopied] = useState<string | null>(null);
  const [office, setOffice] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const offices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pending) counts.set(p.dealerName, (counts.get(p.dealerName) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pending]);

  const visible = useMemo(() => (office ? pending.filter((p) => p.dealerName === office) : pending), [pending, office]);

  // Group the visible cards by office, then by the day they were uploaded, so
  // staff can send one office's batch at a time instead of a mixed list. Server
  // sends them oldest-first, so offices are alphabetical and days run oldest→newest.
  const groups = useMemo<OfficeGroup[]>(() => {
    const byOffice = new Map<string, PendingCard[]>();
    for (const c of visible) {
      const arr = byOffice.get(c.dealerName);
      if (arr) arr.push(c);
      else byOffice.set(c.dealerName, [c]);
    }
    return Array.from(byOffice.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([officeName, cards]) => {
        const byDay = new Map<string, PendingCard[]>();
        for (const c of cards) {
          const k = dayKeyOf(c.requestedAtISO);
          const arr = byDay.get(k);
          if (arr) arr.push(c);
          else byDay.set(k, [c]);
        }
        const days: DayGroup[] = Array.from(byDay.entries()).map(([key, cs]) => ({
          key,
          label: dayLabelOf(cs[0].requestedAtISO),
          cards: cs,
        }));
        return { office: officeName, ids: cards.map((c) => c.id), total: cards.reduce((s, c) => s + c.amount, 0), days };
      });
  }, [visible]);

  const chosen = visible.filter((p) => selected.has(p.id));
  const openCard = pending.find((p) => p.id === openId) ?? null;

  const emailsText = useMemo(() => chosen.map((c) => c.customerEmail).join('\n'), [chosen]);
  const csvText = useMemo(
    () =>
      ['Name,Email,Phone,Amount', ...chosen.map((c) => `${c.customerName.replace(/,/g, ' ')},${c.customerEmail},${c.customerPhone ?? ''},${c.amount}`)].join('\n'),
    [chosen],
  );

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied('failed');
      setTimeout(() => setCopied(null), 1500);
    }
  }

  function downloadCsv() {
    const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = (office || 'all-offices').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `guusto-gift-cards-${slug}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // Replace the whole selection with just this office's cards — the one-office-at-
  // a-time send workflow (then Copy / Mark sent act on exactly that batch).
  function selectOnlyOffice(ids: string[]) {
    setSelected(new Set(ids));
  }
  function toggleGroup(ids: string[], allOn: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }

  if (pending.length === 0) {
    return <div className="card p-8 text-center text-sm text-gray-500">No pending gift cards — all caught up. 🎉</div>;
  }

  return (
    <div className="space-y-4">
      {offices.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="office" className="text-sm font-medium text-gray-700">Location:</label>
          <select id="office" value={office} onChange={(e) => setOffice(e.target.value)} className="input w-auto text-sm">
            <option value="">All offices ({pending.length})</option>
            {offices.map(([name, count]) => (
              <option key={name} value={name}>{name} ({count})</option>
            ))}
          </select>
          {office && (
            <button type="button" onClick={() => setOffice('')} className="text-xs text-gray-500 underline">clear</button>
          )}
          <span className="text-xs text-gray-400">Grouped by office, then by day uploaded.</span>
        </div>
      )}

      {/* Copy area */}
      <div className="card border-sky-200 bg-sky-50/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Copy the {chosen.length} selected for Guusto:</span>
          <button type="button" onClick={() => copy(emailsText, 'emails')} className="btn-secondary text-xs">Copy emails</button>
          <button type="button" onClick={() => copy(csvText, 'csv')} className="btn-secondary text-xs">Copy CSV (name, email, phone, amount)</button>
          <button type="button" onClick={downloadCsv} disabled={chosen.length === 0} className="btn-secondary text-xs">Download CSV</button>
          {copied === 'emails' && <span className="text-xs text-green-700">✓ Emails copied</span>}
          {copied === 'csv' && <span className="text-xs text-green-700">✓ CSV copied</span>}
          {copied === 'failed' && <span className="text-xs text-red-600">Copy failed — select the box below</span>}
        </div>
        <textarea
          readOnly
          value={emailsText}
          rows={Math.min(6, Math.max(2, chosen.length))}
          className="input mt-2 w-full font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <p className="mt-1 text-xs text-gray-500">Tip: use <strong>Select only</strong> on an office to copy and send that office’s batch on its own.</p>
      </div>

      {/* Queue + mark sent — grouped by office, then day */}
      <form action={action}>
        {state.error && <div className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
        {state.ok && <div className="mb-2 rounded-md bg-green-50 p-2 text-sm text-green-700">{state.message}</div>}

        <div className="space-y-4">
          {groups.map((g) => {
            const groupAllOn = g.ids.every((id) => selected.has(id));
            const groupChosen = g.ids.filter((id) => selected.has(id)).length;
            return (
              <div key={g.office} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={groupAllOn}
                      onChange={() => toggleGroup(g.ids, groupAllOn)}
                      aria-label={`Select all for ${g.office}`}
                    />
                    <span className="text-sm font-semibold text-gray-900">{g.office}</span>
                    <span className="text-xs text-gray-500">{g.ids.length} card{g.ids.length === 1 ? '' : 's'} · ${g.total} · {groupChosen} selected</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectOnlyOffice(g.ids)}
                    className="rounded-md border border-brand-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Select only this office
                  </button>
                </div>

                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {g.days.map((d) => (
                      <GroupDay
                        key={d.key}
                        day={d}
                        selected={selected}
                        toggle={toggle}
                        toggleGroup={toggleGroup}
                        openId={openId}
                        setOpenId={setOpenId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <MarkSentBtn count={chosen.length} />
          <span className="text-xs text-gray-500">Marks the {chosen.length} selected sent and shows each dealer a dated receipt.</span>
        </div>
      </form>

      {/* Note thread lives OUTSIDE the mark-sent form (no nested forms). */}
      {openCard && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">
              {openCard.customerName} · <span className="text-gray-500">{openCard.dealerName}</span>
            </div>
            <button type="button" onClick={() => setOpenId(null)} className="text-xs text-gray-500 underline">close</button>
          </div>
          <GiftCardThread requestId={openCard.id} notes={openCard.notes} side="staff" addAction={addStaffGiftCardNoteAction} />
        </div>
      )}
    </div>
  );
}

function GroupDay({
  day,
  selected,
  toggle,
  toggleGroup,
  openId,
  setOpenId,
}: {
  day: DayGroup;
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleGroup: (ids: string[], allOn: boolean) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const dayIds = day.cards.map((c) => c.id);
  const dayAllOn = dayIds.every((id) => selected.has(id));
  return (
    <>
      <tr className="bg-gray-50/60">
        <td colSpan={5} className="px-3 py-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input type="checkbox" checked={dayAllOn} onChange={() => toggleGroup(dayIds, dayAllOn)} aria-label={`Select all for ${day.label}`} />
            {day.label} · {day.cards.length} uploaded
          </label>
        </td>
      </tr>
      {day.cards.map((c) => (
        <tr key={c.id} className={selected.has(c.id) ? 'bg-brand-50/40' : ''}>
          <td className="px-3 py-3 align-top">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            {selected.has(c.id) && <input type="hidden" name="ids" value={c.id} />}
          </td>
          <td className="px-4 py-3 align-top font-medium text-gray-900">
            <span className="flex items-center gap-1.5">
              {c.staffUnread && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="New message" />}
              {c.customerName}
            </span>
          </td>
          <td className="px-4 py-3 align-top text-gray-600">
            <div>{c.customerEmail}</div>
            {c.customerPhone && <div className="text-xs text-gray-500">📱 {c.customerPhone}</div>}
          </td>
          <td className="px-4 py-3 align-top text-right tabular-nums">
            ${c.amount}
            <div className="text-xs font-normal text-gray-400">{timeOf(c.requestedAtISO)}</div>
          </td>
          <td className="px-4 py-3 align-top text-right">
            <button
              type="button"
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
              className={`text-xs font-medium hover:underline ${c.staffUnread ? 'text-red-600' : 'text-brand-600'}`}
            >
              💬 {c.notes.length > 0 ? c.notes.length : ''} Notes
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

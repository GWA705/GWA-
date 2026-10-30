'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { setCardPaymentStatusAction, recordHdPaymentAction, type ActionState } from '@/app/(staff)/actions';

type CardStatus = 'PENDING' | 'APPROVED' | 'NEEDS_AUTH' | 'DECLINED';

export interface CardPaymentVM {
  status: CardStatus;
  note: string | null;
  byName: string | null;
  at: string | null; // pre-formatted
  amountLabel: string; // e.g. "$6,378.85"
  codeLabel: string; // "CC" / "CCHD" / "HDCC"
}
export interface HdPaymentVM {
  financeCompany: string; // "Enercare" / "UEI"
  card: 'SEAN' | 'JJ' | null;
  amountLabel: string | null;
  dateLabel: string | null; // pre-formatted (en-CA)
  defaultAmount: string; // prefill, e.g. "9500.00"
}

function Submitting({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? 'Saving…' : label}</>;
}

function StatusPill({ status }: { status: CardStatus }) {
  if (status === 'APPROVED') return <span className="badge bg-green-100 text-green-800">Approved · received</span>;
  if (status === 'NEEDS_AUTH') return <span className="badge bg-amber-100 text-amber-800">Needs in-store auth</span>;
  if (status === 'DECLINED') return <span className="badge bg-red-100 text-red-800">Declined — needs attention</span>;
  return <span className="badge bg-gray-100 text-gray-600">Not recorded</span>;
}

function CustomerCard({ applicationId, card }: { applicationId: string; card: CardPaymentVM }) {
  const [state, action] = useFormState(
    setCardPaymentStatusAction.bind(null, applicationId),
    {} as ActionState,
  );
  const [optimistic, setOptimistic] = useState<CardStatus | null>(null);
  const status = optimistic ?? card.status;

  return (
    <form action={action} className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Customer card payment
            <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-indigo-700">{card.codeLabel}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{card.amountLabel} to collect — mark whether the card went through.</p>
        </div>
        <StatusPill status={status} />
      </div>

      {status === 'DECLINED' && (
        <p className="mt-2 rounded bg-red-50 p-2 text-xs font-medium text-red-800">
          ⚠ Needs attention — payment not received. Funding stays blocked and the dealer has been asked to arrange another payment method.
        </p>
      )}
      {status === 'NEEDS_AUTH' && (
        <p className="mt-2 rounded bg-amber-50 p-2 text-xs font-medium text-amber-800">
          The customer must authorize this card in store before the deal can fund. The dealer has been notified.
        </p>
      )}

      <div className="mt-2">
        <textarea
          name="note"
          rows={2}
          defaultValue={card.note ?? ''}
          placeholder="Optional note for the dealer (why it was declined, what's needed)…"
          className="input text-sm"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="submit" name="status" value="APPROVED" onClick={() => setOptimistic('APPROVED')}
          className={status === 'APPROVED' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
          <Submitting label="Approved" />
        </button>
        <button type="submit" name="status" value="NEEDS_AUTH" onClick={() => setOptimistic('NEEDS_AUTH')}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
          Needs in-store auth
        </button>
        <button type="submit" name="status" value="DECLINED" onClick={() => setOptimistic('DECLINED')}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Declined
        </button>
        {status !== 'APPROVED' && (
          <button type="submit" name="status" value="PENDING" onClick={() => setOptimistic('PENDING')}
            className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
        )}
      </div>

      {status !== 'APPROVED' ? (
        <p className="mt-2 text-xs text-amber-700">Funding is blocked until the card is marked Approved.</p>
      ) : (
        card.byName && <p className="mt-2 text-xs text-gray-400">Approved by {card.byName}{card.at ? ` · ${card.at}` : ''}</p>
      )}
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function HdPayment({ applicationId, hd }: { applicationId: string; hd: HdPaymentVM }) {
  const [state, action] = useFormState(
    recordHdPaymentAction.bind(null, applicationId),
    {} as ActionState,
  );
  const [cardSel, setCardSel] = useState<'SEAN' | 'JJ' | null>(hd.card);
  const recorded = !!hd.card;

  return (
    <form action={action} className="rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-900">Paid to Home Depot</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Financed through {hd.financeCompany}, so GWA pays Home Depot. Records whose card was used → journal columns L / M / N.
      </p>

      {recorded && (
        <p className="mt-2 rounded bg-green-50 p-2 text-xs font-medium text-green-800">
          ✓ Recorded: {hd.card} · {hd.amountLabel} · {hd.dateLabel} — written to the journal.
        </p>
      )}

      <input type="hidden" name="card" value={cardSel ?? ''} />
      <div className="mt-3">
        <span className="label text-xs">Whose card was used</span>
        <div className="mt-1 flex gap-2">
          {(['SEAN', 'JJ'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCardSel(c)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${cardSel === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}>
              {c === 'SEAN' ? 'Sean' : 'JJ'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="label text-xs" htmlFor="hdAmount">Amount charged</label>
          <input id="hdAmount" name="amount" defaultValue={hd.amountLabel ? hd.amountLabel.replace(/[^0-9.]/g, '') : hd.defaultAmount} inputMode="decimal" className="input text-sm" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="label text-xs" htmlFor="hdDate">Date paid</label>
          <input id="hdDate" name="date" type="date" className="input text-sm" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" className="btn-primary text-sm" disabled={!cardSel}>
          <Submitting label={recorded ? 'Update journal' : 'Record & write to journal'} />
        </button>
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/**
 * Reviewer payment-tracking panel on the Review-signed-documents step. Shows the
 * customer card/deposit status control when the deal is paid by card, and — for
 * HD Enercare/UEI deals — the office-to-Home-Depot payment recorder. Hidden
 * entirely when neither applies.
 */
export function PaymentTrackingPanel({
  applicationId,
  card,
  hd,
}: {
  applicationId: string;
  card: CardPaymentVM | null;
  hd: HdPaymentVM | null;
}) {
  if (!card && !hd) return null;
  return (
    <div className="border-t border-gray-100 pt-4">
      <h3 className="mb-1 text-sm font-medium text-gray-700">Payment tracking</h3>
      <p className="mb-3 text-xs text-gray-500">Track the money on this deal. Everything here writes back to the sales journal.</p>
      <div className="space-y-3">
        {card && <CustomerCard applicationId={applicationId} card={card} />}
        {hd && <HdPayment applicationId={applicationId} hd={hd} />}
      </div>
    </div>
  );
}

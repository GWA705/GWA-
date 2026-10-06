'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { logCustomerCallAction, forwardCustomerCallAction, type CallState } from './actions';
import type { CustomerCallVM } from '@/lib/customerCalls';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save call'}
    </button>
  );
}

/**
 * The customer call log + snapshot. "Customer called" opens a dated note; a
 * running count shows how many times this customer has phoned and how many were
 * forwarded to their office. Optionally notifies the office in the same step.
 */
export function CustomerCallLog({
  applicationId,
  officeName,
  total,
  forwarded,
  lastAt,
  calls,
}: {
  applicationId: string;
  officeName: string;
  total: number;
  forwarded: number;
  lastAt: string | null;
  calls: CustomerCallVM[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(logCustomerCallAction.bind(null, applicationId), {} as CallState);
  const formRef = useRef<HTMLFormElement>(null);
  const [fwdId, setFwdId] = useState<string | null>(null);
  const [fwdErr, setFwdErr] = useState<{ id: string; msg: string } | null>(null);
  const [, startFwd] = useTransition();

  function forward(id: string) {
    setFwdErr(null);
    setFwdId(id);
    startFwd(async () => {
      const res = await forwardCustomerCallAction(id);
      setFwdId(null);
      if (res?.error) setFwdErr({ id, msg: res.error });
      else router.refresh();
    });
  }

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">📞 Call log</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-primary text-sm">
          ＋ Customer called
        </button>
      </div>

      {/* Snapshot */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-slate-100">{total}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Calls logged</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-slate-100">{forwarded}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Forwarded to office</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">{lastAt ? lastAt.split(',')[0] : '—'}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Last call</div>
        </div>
      </div>

      {/* Log form */}
      {open && (
        <form ref={formRef} action={action} className="mt-3 rounded-xl border border-gray-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/40">
          {state.error && <div className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
          <div className="mb-2 text-xs text-gray-500 dark:text-slate-400">🕑 Dated automatically when you save.</div>
          <textarea
            name="note"
            rows={2}
            required
            className="input"
            placeholder="What did they call about? (e.g. asking about filter replacement timing)"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
            <input type="checkbox" name="forward" /> Also notify <b>{officeName}</b> (the office that deals with them)
          </label>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <SaveBtn />
          </div>
        </form>
      )}

      {/* History */}
      <div className="mt-4 space-y-2">
        {calls.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">No calls logged yet.</p>
        ) : (
          calls.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-slate-50/60 p-2.5 dark:border-slate-700 dark:bg-slate-700/30">
              <div className="mb-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                <span>🕑 {c.at}</span>
                <span>· {c.loggedBy}</span>
                {c.forwarded ? (
                  <span className="rounded border-l-2 border-green-600 bg-green-50 px-1.5 py-0.5 font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    ↗ Forwarded to {officeName}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => forward(c.id)}
                    disabled={fwdId === c.id}
                    className="rounded border border-sky-300 px-1.5 py-0.5 font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-700 dark:text-sky-300"
                  >
                    {fwdId === c.id ? 'Sending…' : `↗ Forward to ${officeName}`}
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-800 dark:text-slate-100">{c.note}</div>
              {fwdErr?.id === c.id && <div className="mt-1 text-xs text-red-600">{fwdErr.msg}</div>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

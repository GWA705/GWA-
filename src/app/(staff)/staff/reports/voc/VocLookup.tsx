'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { vocLookupAction } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm disabled:opacity-60" disabled={pending}>
      {pending ? 'Checking…' : 'Check completion'}
    </button>
  );
}

/**
 * "Has a VOC been done?" tool. Paste one or many HD Lead #s (or upload a list),
 * and see which have a completed VOC and which are still outstanding.
 */
export function VocLookup() {
  const [state, action] = useFormState(vocLookupAction, {} as Awaited<ReturnType<typeof vocLookupAction>>);
  const result = state.result;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-gray-900">Check VOC completion</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Paste HD Lead #s (one per line, or comma/space separated) and/or upload a list (.xlsx, .csv, .txt). We’ll show
        which have a completed VOC.
      </p>
      <form action={action} className="mt-3 space-y-3">
        <textarea
          name="refs"
          rows={4}
          placeholder="800237993&#10;800236265&#10;701641875"
          className="input w-full font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-800 hover:file:bg-gray-300"
          />
          <SubmitBtn />
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>

      {result && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-gray-700">
            <span className="font-semibold text-emerald-700">{result.completedCount} completed</span> ·{' '}
            <span className="font-semibold text-amber-700">{result.outstandingCount} outstanding</span> of {result.total}{' '}
            checked
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#123448]/30 bg-[#eef3f6] text-left text-[11px] uppercase tracking-wide text-[#123448]">
                  <th className="px-4 py-2.5">Lead #</th>
                  <th className="px-4 py-2.5">VOC done?</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Office</th>
                  <th className="px-4 py-2.5">Sales rep</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.rows.map((r, i) => (
                  <tr key={i} className={r.completed ? '' : 'bg-amber-50/50'}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.ref}</td>
                    <td className="px-4 py-2">
                      {r.completed ? (
                        <span className="font-semibold text-emerald-700">✓ Yes</span>
                      ) : (
                        <span className="font-semibold text-amber-700">— Not yet</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.submissionDate ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.office ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.rep ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

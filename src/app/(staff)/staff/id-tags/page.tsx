import { requireStaffSection } from '@/lib/session';
import { listOfficeIdTagPasswords } from '@/lib/idTag';
import { saveOfficeIdTagPasswordAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Staff → ID tags → Office passwords. Reviewers (and admins with the 'id-tags'
 * section) set ONE standardized temporary password per office. That password is
 * dropped into every new-rep Home Depot onboarding email for the office, so the
 * Entuitive screening sign-in is identical every time — no more one-off
 * passwords to chase down.
 */
export default async function StaffIdTagPasswordsPage() {
  await requireStaffSection('id-tags');
  const offices = await listOfficeIdTagPasswords();
  const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200';
  const setCount = offices.filter((o) => o.password).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">ID Tag — office passwords</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each office gets one standardized temporary password. It’s used in every new-rep onboarding
        email for that office, so the Entuitive background-screening sign-in is the same every time.
      </p>

      <div className={`${card} mt-5 p-4`}>
        <p className="text-sm text-slate-700">
          <strong>How it works.</strong> Set a password per office — the house format is one word
          plus <code className="rounded bg-slate-100 px-1">123!</code> (e.g.{' '}
          <code className="rounded bg-slate-100 px-1">Winnipeg123!</code> or{' '}
          <code className="rounded bg-slate-100 px-1">CAWS123!</code>). A suggestion is pre-filled as a
          placeholder; type to set your own. Leave a row blank to fall back to the global screening
          password in <span className="font-medium">Admin → ID tags → settings</span>.
        </p>
        <p className="mt-2 text-xs text-slate-500">{setCount} of {offices.length} offices have a password set.</p>
      </div>

      <div className={`${card} mt-4 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Office</th>
                <th className="px-4 py-2.5 font-semibold">Standardized password</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {offices.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">No active offices.</td></tr>
              )}
              {offices.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 align-middle">
                  <td className="px-4 py-3 font-semibold text-slate-900">{o.name}</td>
                  <td className="px-4 py-3">
                    <form action={saveOfficeIdTagPasswordAction} className="flex items-center gap-2">
                      <input type="hidden" name="dealerId" value={o.id} />
                      <input
                        name="password"
                        defaultValue={o.password}
                        placeholder={o.suggestion}
                        autoComplete="off"
                        spellCheck={false}
                        className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm"
                      />
                      <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900">Save</button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {o.password
                      ? <span className="font-semibold text-green-700">✓ Set</span>
                      : <span>Using global default</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

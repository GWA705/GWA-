import Link from 'next/link';
import type { Lead } from '@/lib/leads';

// Read-only, searchable list of HD leads with running totals. Shared by the
// dealer (own office) and internal (all offices) pages. No download — view only.

function fmtDate(d: Date | null, fallback: string): string {
  if (!d) return fallback;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <div className="text-sm text-gray-700">{value}</div>
    </div>
  );
}

export function LeadsView({
  leads,
  summary,
  q,
  status,
  basePath,
  extraHidden,
}: {
  leads: Lead[];
  summary: { total: number; noGood: number; forwarded: number };
  q: string;
  status: string;
  basePath: string;
  extraHidden?: { name: string; value: string }[];
}) {
  const statusLink = (val: string, label: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (val) params.set('status', val);
    for (const h of extraHidden ?? []) if (h.value) params.set(h.name, h.value);
    const active = status === val;
    return (
      <Link
        href={`${basePath}${params.toString() ? `?${params}` : ''}`}
        className={`rounded-full px-3 py-1 text-sm font-medium transition ${active ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-gray-900 tabular-nums">{summary.total}</div>
          <div className="text-[10px] uppercase text-gray-500">Leads received</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-emerald-600 tabular-nums">{summary.forwarded}</div>
          <div className="text-[10px] uppercase text-gray-500">Forwarded / active</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-red-600 tabular-nums">{summary.noGood}</div>
          <div className="text-[10px] uppercase text-gray-500">Marked no-good</div>
        </div>
      </div>

      {/* Search + filter */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, phone, email, address, booking, store…" className="input min-w-[220px] flex-1" />
        {extraHidden?.map((h) => (h.value ? <input key={h.name} type="hidden" name={h.name} value={h.value} /> : null))}
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {statusLink('', 'All')}
        {statusLink('forwarded', 'Forwarded')}
        {statusLink('nogood', 'No-good')}
      </div>

      {/* List */}
      {leads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          {q || status ? 'No leads match your search.' : 'No leads yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <div key={l.rowId} className={`rounded-xl border bg-white p-4 ${l.noGood ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">{l.customerName || '(no name)'}</div>
                  <div className="text-xs text-gray-500">
                    {fmtDate(l.dateReceived, l.dateText)}
                    {l.storeNumber && <> · Store {l.storeNumber}</>}
                    {l.service && <> · {l.service}</>}
                    {l.bookingId && <> · #{l.bookingId}</>}
                  </div>
                </div>
                <span className={`badge ${l.noGood ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                  {l.noGood ? 'No good' : l.status || 'Forwarded'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Phone" value={l.phone} />
                <Field label="Email" value={l.email} />
                <Field label="Contact pref" value={l.contactPreference} />
                <div className="col-span-2 sm:col-span-3">
                  <Field label="Address" value={l.address} />
                </div>
                <Field label="Emergency" value={l.emergency} />
                <Field label="Financing" value={l.financing} />
                <Field label="Forwarded to" value={l.forwardedTo} />
                <div className="col-span-2 sm:col-span-3">
                  <Field label="Service details" value={l.serviceDetails} />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <Field label="Additional info" value={l.additionalInfo} />
                </div>
              </div>

              {l.noGood && (l.noGoodReason || l.reportedToHd) && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  {l.noGoodReason && <div><span className="font-semibold">No-good reason:</span> {l.noGoodReason}</div>}
                  {l.reportedToHd && <div className="mt-0.5"><span className="font-semibold">Reported to HD:</span> {l.reportedToHd}{l.dateReported ? ` (${l.dateReported})` : ''}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Apply the q + status filters to a lead list (server-side). */
export function filterLeads(leads: Lead[], q: string, status: string): Lead[] {
  let out = leads;
  if (status === 'nogood') out = out.filter((l) => l.noGood);
  else if (status === 'forwarded') out = out.filter((l) => !l.noGood);
  const needle = q.trim().toLowerCase();
  if (needle) {
    out = out.filter((l) =>
      [l.customerName, l.phone, l.email, l.address, l.bookingId, l.storeNumber, l.service]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }
  return out;
}

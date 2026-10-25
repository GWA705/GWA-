import { bookingActivityFor, type BookingActivityItem } from '@/lib/bookingEvents';

/**
 * Booking activity for this deal — appointments, installs and service visits the
 * booking app streamed back (/api/intake/booking-event). Matched by this deal's
 * id and by the customer's phone (a lead and its later funded deal have
 * different ids, so phone stitches them). Renders nothing until there's activity.
 */

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(cents: unknown): string | null {
  const n = typeof cents === 'number' ? cents : typeof cents === 'string' ? Number(cents) : NaN;
  if (!isFinite(n)) return null;
  return `$${(n / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function detailFor(ev: BookingActivityItem): string {
  const p = ev.payload;
  const bits: string[] = [];
  if (ev.type === 'appointment') {
    if (ev.outcome) bits.push(titleCase(ev.outcome));
    const amt = money(p.saleAmountCents);
    if (amt) bits.push(amt);
    if (typeof p.soldUnits === 'number' && p.soldUnits > 0) bits.push(`${p.soldUnits} unit${p.soldUnits === 1 ? '' : 's'}`);
    if (typeof p.repName === 'string' && p.repName.trim()) bits.push(`rep ${p.repName.trim()}`);
  } else if (ev.type === 'install') {
    if (typeof p.installerName === 'string' && p.installerName.trim()) bits.push(`installer ${p.installerName.trim()}`);
  } else if (ev.type === 'service') {
    if (typeof p.note === 'string' && p.note.trim()) bits.push(p.note.trim().slice(0, 120));
  }
  return bits.join(' · ');
}

const DOT: Record<string, string> = {
  appointment: 'bg-blue-500',
  install: 'bg-emerald-500',
  service: 'bg-amber-500',
};

export async function BookingActivityCard({ applicationId, phone }: { applicationId: string; phone: string | null }) {
  let events: BookingActivityItem[] = [];
  try {
    events = await bookingActivityFor({ portalRefs: [applicationId], phone });
  } catch {
    return null; // never break the deal page on a booking-activity hiccup
  }
  if (events.length === 0) return null;

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Booking activity</h2>
      <ul className="space-y-2">
        {events.map((ev) => {
          const when = ev.occurredAt ?? ev.receivedAt;
          const detail = detailFor(ev);
          return (
            <li key={ev.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[ev.type] ?? 'bg-gray-400'}`} aria-hidden />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-gray-900">{titleCase(ev.type)}</span>
                  {ev.stage && <span className="text-gray-600">{titleCase(ev.stage)}</span>}
                  <span className="text-xs text-gray-400">{when.toLocaleDateString('en-CA')}</span>
                </div>
                {detail && <div className="text-xs text-gray-500">{detail}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

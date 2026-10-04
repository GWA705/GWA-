import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { HERO_SLOTS, hourFromHeroPath } from '@/lib/heroSlots';
import { specialIsLive } from '@/lib/dashboardHero';
import { listHeroImages } from '@/lib/heroImage';
import { SlotHeroForm } from './SlotHeroForm';
import { SpecialHeroForm } from './SpecialHeroForm';
import { toggleDashboardHeroActiveAction, deleteDashboardHeroAction, clearSlotHeroAction } from '@/app/(admin)/actions';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

export default async function DashboardHeroPage() {
  await requireAdminSection('dashboard-hero');
  const [rows, files] = await Promise.all([
    prisma.dashboardHero.findMany({ orderBy: { createdAt: 'desc' } }),
    listHeroImages(),
  ]);

  // Uploaded hero per slot (newest wins), plus the file-based default for preview.
  const uploadBySlot = new Map<number, { id: string; url: string }>();
  for (const r of rows) {
    if (r.kind === 'SLOT' && r.slotHour != null && !uploadBySlot.has(r.slotHour)) {
      uploadBySlot.set(r.slotHour, { id: r.id, url: `/api/dashboard-hero/${r.id}/image?v=${r.updatedAt.getTime()}` });
    }
  }
  const fileBySlot = new Map<number, string>();
  for (const p of files) {
    const h = hourFromHeroPath(p);
    if (h != null && !fileBySlot.has(h)) fileBySlot.set(h, p);
  }

  const specials = rows.filter((r) => r.kind === 'SPECIAL');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard hero</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          The background image on the dealer dashboard changes by time of day. Upload your own for any slot, or set up a
          special occasion (a GIF is fine) that takes over for a date range and switches itself back off.
        </p>
      </div>

      {/* Time-of-day slots */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Time of day</h2>
        <p className="mb-4 text-sm text-gray-500">Each slot shows its hero until the next one starts. Night runs 11 PM–5 AM. Leave a slot empty to use the built-in default.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HERO_SLOTS.map((s) => {
            const up = uploadBySlot.get(s.hour);
            const file = fileBySlot.get(s.hour);
            const src = up?.url ?? file ?? null;
            const label12 = ((s.hour % 12) || 12) + (s.hour < 12 ? ' AM' : ' PM');
            return (
              <div key={s.hour} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                  <span className="text-xs tabular-nums text-gray-400">{label12}</span>
                </div>
                <div className="mb-2 aspect-[1920/641] overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-gray-400">No image</div>
                  )}
                </div>
                <div className="mb-1 text-[11px] text-gray-400">
                  {up ? 'Uploaded' : file ? 'Built-in default' : 'Using the gradient fallback'}
                </div>
                <SlotHeroForm slotHour={s.hour} hasImage={!!up} />
                {up && (
                  <form action={clearSlotHeroAction.bind(null, s.hour)} className="mt-1">
                    <button type="submit" className="w-full text-xs text-gray-500 hover:underline">Remove (use default)</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Special occasions */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Special occasions</h2>
        <p className="mb-4 text-sm text-gray-500">Pre-load Halloween, Christmas, a sale — set the dates and it comes and goes on its own.</p>
        <SpecialHeroForm />

        <div className="mt-5 space-y-3">
          {specials.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No special occasions set up yet.</div>
          ) : (
            specials.map((h) => {
              const live = h.active && specialIsLive(h);
              return (
                <div key={h.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/dashboard-hero/${h.id}/image?v=${h.updatedAt.getTime()}`} alt="" className="h-14 w-24 flex-none rounded border border-gray-200 object-cover" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{h.name || 'Special occasion'}</span>
                        {live && <span className="badge bg-green-100 text-green-800">Live now</span>}
                        {!h.active && <span className="badge bg-gray-100 text-gray-600">Off</span>}
                        <span className="badge bg-brand-50 text-brand-700">{h.scope === 'NIGHT' ? 'Nights only' : 'Whole day'}</span>
                      </div>
                      <div className="mt-1 text-xs tabular-nums text-gray-500">{fmtDate(h.startsOn)} → {fmtDate(h.endsOn)}</div>
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2">
                    <form action={toggleDashboardHeroActiveAction.bind(null, h.id)}>
                      <button type="submit" className="btn-secondary w-full text-xs">{h.active ? 'Turn off' : 'Turn on'}</button>
                    </form>
                    <form action={deleteDashboardHeroAction.bind(null, h.id)}>
                      <button type="submit" className="btn-danger w-full text-xs">Delete</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

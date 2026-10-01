import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isSuperAdmin, canAdminSection } from '@/lib/rbac';
import { readLeads, summarize, storeNameMap, leadKeyOf } from '@/lib/leads';
import { readLeadCalls } from '@/lib/leadCalls';
import { leadsSheetId, reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices } from '@/lib/reporting/monthly';
import { LeadsView, filterLeads, leadMonthOptions, leadOutcomeKey } from '@/components/LeadsView';
import { CombinedLeadsView } from '@/components/CombinedLeadsView';
import { leadsGeoData, storeGeos, unplacedStoresForMap } from '@/lib/leadGeo';
import { MailInTestWorkspace } from '@/components/MailInTestWorkspace';
import { type ScannedLeadRow } from '@/components/ScannedLeadsList';
import { BackfillBookingButton } from '@/components/BackfillBookingButton';
import { PostalFillButton } from '@/components/PostalFillButton';
import { scannedLeadKey } from '@/lib/scannedLeadKey';
import { listScannedLeads } from '@/lib/scannedLeads';
import { prisma } from '@/lib/db';
import { aiConfigured } from '@/lib/ai';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function StaffLeadsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; office?: string; page?: string; month?: string; view?: string; outcome?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Viewing all-offices leads is open to every reviewer (so anyone handling a
  // customer call can search whether a store received a lead) plus admins granted
  // the 'leads' section — same model as the Deals/Mail tabs. MANAGING leads (the
  // bulk postal-fill and booking-push tools, which have write/external side
  // effects) stays restricted to leads-section admins / super admins.
  const canManageLeads = isSuperAdmin(user) || canAdminSection(user, 'leads');
  if (user.role !== 'REVIEWER' && !canManageLeads) notFound();

  const t = getT();

  const q = (searchParams.q ?? '').trim();
  const status = (searchParams.status ?? '').trim();
  const officeId = (searchParams.office ?? '').trim();
  const month = (searchParams.month ?? '').trim();
  const outcome = (searchParams.outcome ?? '').trim();
  const view =
    searchParams.view === 'grouped' ? 'grouped'
    : searchParams.view === 'map' ? 'map'
    : searchParams.view === 'all' ? 'all'
    : 'list';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  // Scanned lead cards — independent of the HD Leads Log sheet. Staff normally see
  // every office's cards, but when an office is selected we scope to just that
  // office (matching exactly what that office sees — listScannedLeads filters a
  // dealer to dealerId === their own), so an admin's "view as office" is accurate.
  const scannedAll = await listScannedLeads(user);
  const scannedRaw = officeId ? scannedAll.filter((l) => l.dealerId === officeId) : scannedAll;
  const dealerIds = Array.from(new Set(scannedRaw.map((l) => l.dealerId).filter((x): x is string => !!x)));
  const nameById = new Map(
    (dealerIds.length ? await prisma.dealer.findMany({ where: { id: { in: dealerIds } }, select: { id: true, name: true } }) : [])
      .map((d) => [d.id, d.name] as const),
  );
  const scanned: ScannedLeadRow[] = scannedRaw.map((l) => ({
    id: l.id, customerName: l.customerName, phone: l.phone, address: l.address, city: l.city, postalCode: l.postalCode,
    storeNumber: l.storeNumber, collectedOn: l.collectedOn, ownsHome: l.ownsHome, waterSource: l.waterSource,
    waterQuality: l.waterQuality, conditions: l.conditions, householdSize: l.householdSize, waterNotes: l.waterNotes, note: l.note,
    generatorName: l.generatorName, confidence: l.confidence, status: l.status, bookingStatus: l.bookingStatus, hasPhoto: !!l.photoStorageKey,
    scannedByName: l.scannedByName, officeName: l.dealerId ? nameById.get(l.dealerId) ?? null : null, createdAt: l.createdAt.toISOString(),
  }));
  // Staff see all offices' mail-in cards — no office scope on the call read.
  const scannedCalls = await readLeadCalls(scanned.map((s) => scannedLeadKey(s.id)));
  const scannedSection = (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">HD Mail In Test</h2>
      {canManageLeads && (
        <div className="mb-3 grid gap-3 md:grid-cols-2"><PostalFillButton /><BackfillBookingButton /></div>
      )}
      <MailInTestWorkspace leads={scanned} callsByKey={scannedCalls} showOffice={!officeId} canScan={aiConfigured()} />
    </div>
  );

  if (!leadsSheetId() || !reportingJournalEnabled()) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-gray-900">{t('leads.heroEyebrow')}</h1>
        {scannedSection}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('staffLeads.notConnectedBefore')}<code className="rounded bg-amber-100 px-1">HD_LEADS_SHEET_ID</code>{t('staffLeads.notConnectedAfter')}
        </div>
      </div>
    );
  }

  const [read, offices, storeNames] = await Promise.all([readLeads(), listReportOffices(), storeNameMap()]);
  const office = offices.find((o) => o.dealerId === officeId) || null;

  // Scope by the selected office's store numbers (or all offices when none picked).
  let scoped = read.leads;
  if (office) {
    const set = new Set(office.storeNumbers);
    scoped = scoped.filter((l) => set.has(l.storeNumber));
  }
  const summary = summarize(scoped);
  const monthOptions = leadMonthOptions(scoped);
  let filtered = filterLeads(scoped, q, status, month);
  // The combined "All leads" view does its own filtering client-side over the full
  // office-scoped set, so load calls for that superset there; otherwise just for
  // the filtered list the normal view shows.
  const callsByKey = await readLeadCalls((view === 'all' ? scoped : filtered).map(leadKeyOf));
  if (outcome) {
    filtered = filtered.filter((l) => leadOutcomeKey(l.noGood, callsByKey[leadKeyOf(l)] ?? []) === outcome);
  }
  const parsedView = view === 'all' ? 'list' : view; // LeadsView never renders in 'all'

  // Map data — only when the map is shown. Scoped to the selected office, or all
  // offices when none is picked (the leadership all-offices map).
  const geo =
    view === 'map'
      ? {
          stores: await storeGeos(office?.dealerId),
          pendingStores: await unplacedStoresForMap(office?.dealerId),
          byKey: await leadsGeoData(filtered),
        }
      : undefined;

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow={t('leads.heroEyebrow')}
        title={t('leads.heroTitle')}
        subtitle={t('staffLeads.heroSubtitle')}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">{t('staffLeads.officeLabel')}</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]" aria-label={t('staffLeads.officeLabel')}>
            <option value="">{t('staffLeads.allOffices')}</option>
            {offices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        {q && <input type="hidden" name="q" value={q} />}
        {status && <input type="hidden" name="status" value={status} />}
        {month && <input type="hidden" name="month" value={month} />}
        {outcome && <input type="hidden" name="outcome" value={outcome} />}
        {view !== 'list' && <input type="hidden" name="view" value={view} />}
        <button type="submit" className="btn-primary">{t('staffLeads.viewButton')}</button>
      </form>

      {read.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          {t('leads.readError', { error: read.error })}
        </div>
      )}

      {view === 'all' ? (
        <div className="space-y-3">
          {canManageLeads && (
            <div className="grid gap-3 md:grid-cols-2"><PostalFillButton /><BackfillBookingButton /></div>
          )}
          {/* View toggle (page-level here, since the combined list replaces LeadsView) */}
          <div className="inline-flex rounded-full bg-gray-100 p-0.5" role="group" aria-label={t('leads.viewAria')}>
            {([['list', t('leads.viewList')], ['grouped', t('leads.viewGrouped')], ['map', t('leads.viewMap')], ['all', 'All leads']] as const).map(([v, label]) => {
              const href = v === 'list'
                ? `/staff/leads${officeId ? `?office=${officeId}` : ''}`
                : `/staff/leads?view=${v}${officeId ? `&office=${officeId}` : ''}`;
              const active = view === v;
              return (
                <Link key={v} href={href} className={`px-3 py-1 text-sm font-medium transition ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                  {label}
                </Link>
              );
            })}
          </div>
          <CombinedLeadsView
            parsed={scoped}
            scanned={scanned}
            parsedCalls={callsByKey}
            scannedCalls={scannedCalls}
            storeNames={storeNames}
            showOffice={!officeId}
          />
        </div>
      ) : (
        <>
          {scannedSection}
          <LeadsView
            leads={filtered}
            summary={summary}
            q={q}
            status={status}
            basePath="/staff/leads"
            extraHidden={[{ name: 'office', value: officeId }]}
            page={page}
            month={month}
            monthOptions={monthOptions}
            storeNames={storeNames}
            callsByKey={callsByKey}
            isStaff
            view={parsedView}
            outcome={outcome}
            geo={geo}
          />
        </>
      )}
    </div>
  );
}

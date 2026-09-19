import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { readLeads, dealerStoreNumbers, summarize, storeNameMap, leadKeyOf } from '@/lib/leads';
import { readLeadCalls } from '@/lib/leadCalls';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { leadsSheetId } from '@/lib/reporting/journalRead';
import { LeadsView, filterLeads, leadMonthOptions, leadOutcomeKey } from '@/components/LeadsView';
import { leadsGeoData, storeGeos, unplacedStoresForMap } from '@/lib/leadGeo';
import { SectionHero } from '@/components/SectionHero';
import { MailInTestWorkspace } from '@/components/MailInTestWorkspace';
import { LeadsTabs, type LeadsTab } from '@/components/LeadsTabs';
import { type ScannedLeadRow } from '@/components/ScannedLeadsList';
import { scannedLeadKey } from '@/lib/scannedLeadKey';
import { listScannedLeads } from '@/lib/scannedLeads';
import { aiConfigured } from '@/lib/ai';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

function toRow(l: Awaited<ReturnType<typeof listScannedLeads>>[number]): ScannedLeadRow {
  return {
    id: l.id, customerName: l.customerName, phone: l.phone, address: l.address, city: l.city, postalCode: l.postalCode,
    storeNumber: l.storeNumber, collectedOn: l.collectedOn, ownsHome: l.ownsHome, waterSource: l.waterSource,
    waterQuality: l.waterQuality, conditions: l.conditions, householdSize: l.householdSize, waterNotes: l.waterNotes, note: l.note,
    generatorName: l.generatorName, confidence: l.confidence, status: l.status, hasPhoto: !!l.photoStorageKey,
    scannedByName: l.scannedByName, createdAt: l.createdAt.toISOString(),
  };
}

const SECTION_H = 'text-sm font-semibold uppercase tracking-wide text-gray-500';

export default async function DealerLeadsPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string; month?: string; view?: string; outcome?: string; tab?: string } }) {
  const user = await requireDealerAccess();
  const t = getT();
  const q = (searchParams.q ?? '').trim();
  const status = (searchParams.status ?? '').trim();
  const month = (searchParams.month ?? '').trim();
  const outcome = (searchParams.outcome ?? '').trim();
  const view = searchParams.view === 'grouped' ? 'grouped' : searchParams.view === 'map' ? 'map' : 'list';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const tab: LeadsTab = searchParams.tab === 'mailin' ? 'mailin' : searchParams.tab === 'store' ? 'store' : 'all';

  // A dealer (or an admin viewing as one) only ever sees their own office's call
  // activity — scope every LeadCall read to this office.
  const callScope = { dealerId: user.dealerId };

  // ── HD Mail In Test (scanned cards) — always available, independent of the sheet.
  const scanned = (await listScannedLeads(user)).map(toRow);
  const scannedCalls = await readLeadCalls(scanned.map((s) => scannedLeadKey(s.id)), callScope);
  const mailinSection = <MailInTestWorkspace leads={scanned} callsByKey={scannedCalls} canScan={aiConfigured()} />;

  // ── Store (Home Depot leads from the HD Leads Log). Compute the count for the
  // tab badge whenever it's configured; only build the full view when it's shown.
  const showMailin = tab === 'mailin' || tab === 'all';
  const showStore = tab === 'store' || tab === 'all';
  const storeConfigured = !!leadsSheetId() && reportingJournalEnabled();

  let storeCount = 0;
  let storeSection: React.ReactNode = null;

  if (!storeConfigured) {
    if (showStore) storeSection = <NotReadyNote />;
  } else {
    const [read, myStores, storeNames] = await Promise.all([
      readLeads(),
      user.dealerId ? dealerStoreNumbers(user.dealerId) : Promise.resolve([]),
      user.dealerId ? storeNameMap(user.dealerId) : Promise.resolve({}),
    ]);
    if (myStores.length === 0) {
      if (showStore) {
        storeSection = (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
            {t('leads.noStoresBefore')}
            <Link href="/dealer/support" className="underline">{t('leads.contactLink')}</Link>
            {t('leads.noStoresAfter')}
          </div>
        );
      }
    } else {
      const storeSet = new Set(myStores);
      const mine = read.leads.filter((l) => storeSet.has(l.storeNumber));
      const summary = summarize(mine);
      storeCount = summary.total;
      if (showStore) {
        const monthOptions = leadMonthOptions(mine);
        let filtered = filterLeads(mine, q, status, month);
        const callsByKey = await readLeadCalls(filtered.map(leadKeyOf), callScope);
        if (outcome) {
          filtered = filtered.filter((l) => leadOutcomeKey(l.noGood, callsByKey[leadKeyOf(l)] ?? []) === outcome);
        }
        const geo =
          view === 'map' && user.dealerId
            ? {
                stores: await storeGeos(user.dealerId),
                pendingStores: await unplacedStoresForMap(user.dealerId),
                byKey: await leadsGeoData(filtered),
              }
            : undefined;
        storeSection = (
          <>
            {read.error && (
              <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
                {t('leads.readError', { error: read.error })}
              </div>
            )}
            <LeadsView
              leads={filtered} summary={summary} q={q} status={status} basePath="/dealer/leads" page={page}
              month={month} monthOptions={monthOptions} storeNames={storeNames} callsByKey={callsByKey}
              view={view} outcome={outcome} geo={geo} extraHidden={[{ name: 'tab', value: tab }]}
            />
          </>
        );
      }
    }
  }

  const counts = { all: scanned.length + storeCount, mailin: scanned.length, store: storeCount };
  const withHeadings = tab === 'all';

  return (
    <div className="space-y-6">
      <Header />
      <LeadsTabs tab={tab} basePath="/dealer/leads" counts={counts} />
      {showMailin && (
        <section className="space-y-3">
          {withHeadings && <h2 className={SECTION_H}>HD Mail In Test</h2>}
          {mailinSection}
        </section>
      )}
      {showStore && (
        <section className="space-y-5">
          {withHeadings && <h2 className={SECTION_H}>Store</h2>}
          {storeSection}
        </section>
      )}
    </div>
  );
}

function Header() {
  const t = getT();
  return (
    <SectionHero
      eyebrow={t('leads.heroEyebrow')}
      title={t('leads.heroTitle')}
      subtitle={t('leads.heroSubtitle')}
      bgImage="/leads-hero.webp"
    />
  );
}

function NotReadyNote() {
  const t = getT();
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
      {t('leads.notReadyBefore')}
      <Link href="/dealer/support" className="text-sky-600 hover:underline">{t('leads.contactLink')}</Link>
      {t('leads.notReadyAfter')}
    </div>
  );
}

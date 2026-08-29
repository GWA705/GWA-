import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { readLeads, dealerStoreNumbers, summarize, storeNameMap, leadKeyOf } from '@/lib/leads';
import { readLeadCalls } from '@/lib/leadCalls';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { leadsSheetId } from '@/lib/reporting/journalRead';
import { LeadsView, filterLeads, leadMonthOptions, leadOutcomeKey } from '@/components/LeadsView';
import { leadsGeoData, storeGeos } from '@/lib/leadGeo';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function DealerLeadsPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string; month?: string; view?: string; outcome?: string } }) {
  const user = await requireDealerAccess();
  const q = (searchParams.q ?? '').trim();
  const status = (searchParams.status ?? '').trim();
  const month = (searchParams.month ?? '').trim();
  const outcome = (searchParams.outcome ?? '').trim();
  const view = searchParams.view === 'grouped' ? 'grouped' : searchParams.view === 'map' ? 'map' : 'list';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  if (!leadsSheetId() || !reportingJournalEnabled()) {
    return <NotReady />;
  }

  const [read, myStores, storeNames] = await Promise.all([
    readLeads(),
    user.dealerId ? dealerStoreNumbers(user.dealerId) : Promise.resolve([]),
    user.dealerId ? storeNameMap(user.dealerId) : Promise.resolve({}),
  ]);

  if (myStores.length === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          Your office doesn&apos;t have any Home Depot store numbers on file yet, so we can&apos;t match leads to you.
          Please <Link href="/dealer/support" className="underline">contact GWA</Link> to get set up.
        </div>
      </div>
    );
  }

  const storeSet = new Set(myStores);
  const mine = read.leads.filter((l) => storeSet.has(l.storeNumber));
  const summary = summarize(mine);
  const monthOptions = leadMonthOptions(mine);
  let filtered = filterLeads(mine, q, status, month);
  const callsByKey = await readLeadCalls(filtered.map(leadKeyOf));
  if (outcome) {
    filtered = filtered.filter((l) => leadOutcomeKey(l.noGood, callsByKey[leadKeyOf(l)] ?? []) === outcome);
  }

  // Map data — only build it when the map is being shown (it hits the geocode
  // cache + may geocode stores). Scoped to this dealer's own stores.
  const geo =
    view === 'map' && user.dealerId
      ? { stores: await storeGeos(user.dealerId), byKey: await leadsGeoData(filtered) }
      : undefined;

  return (
    <div className="space-y-5">
      <Header />
      {read.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t read the leads log right now: {read.error}
        </div>
      )}
      <LeadsView leads={filtered} summary={summary} q={q} status={status} basePath="/dealer/leads" page={page} month={month} monthOptions={monthOptions} storeNames={storeNames} callsByKey={callsByKey} view={view} outcome={outcome} geo={geo} />
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      variant="rail"
      eyebrow="Leads"
      title="Leads"
      subtitle="Home Depot leads sent to your office. Search and review — updated from the leads log."
    />
  );
}

function NotReady() {
  return (
    <div className="space-y-4">
      <Header />
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        Leads aren&apos;t available yet. Please check back soon or{' '}
        <Link href="/dealer/support" className="text-sky-600 hover:underline">contact GWA</Link>.
      </div>
    </div>
  );
}

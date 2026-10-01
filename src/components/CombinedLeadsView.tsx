import { getT } from '@/i18n/server';
import { StoreLeadRow, storeGroupKey } from './LeadsView';
import { ScannedLeadRowItem, type ScannedLeadRow } from './ScannedLeadsList';
import { scannedGroupKey } from '@/lib/scannedLeadStatus';
import { scannedLeadKey } from '@/lib/scannedLeadKey';
import { leadKeyOf, type Lead } from '@/lib/leads';
import type { LeadCallRow } from '@/lib/leadCalls';
import { CombinedLeadsControls, type CombinedItem } from './CombinedLeadsControls';

/**
 * One combined list of ALL leads for a store/office — scanned "Mail in" cards and
 * HD Leads Log "Store" leads together — so a booker can search and work them in
 * one place instead of two separate sections.
 *
 * Server component: builds each row with its OWN native component
 * (`ScannedLeadRowItem` is client, `StoreLeadRow` is server) so call-logging /
 * booking keep working, tags each "Mail in" / "Store", then hands the ready-made
 * rows to the client `CombinedLeadsControls` for search / filter / sort. (A client
 * component can't import `leads.ts`, which is server-only, so the rows are built
 * here and passed down as elements.)
 */

function TypeTag({ kind }: { kind: 'mailin' | 'store' }) {
  return kind === 'mailin' ? (
    <span className="badge bg-sky-100 text-sky-700">Mail in</span>
  ) : (
    <span className="badge bg-violet-100 text-violet-700">Store</span>
  );
}

export function CombinedLeadsView({
  parsed,
  scanned,
  parsedCalls,
  scannedCalls,
  storeNames,
  showOffice,
}: {
  parsed: Lead[];
  scanned: ScannedLeadRow[];
  parsedCalls: Record<string, LeadCallRow[]>;
  scannedCalls: Record<string, LeadCallRow[]>;
  storeNames: Record<string, string>;
  showOffice: boolean;
}) {
  const t = getT();
  const items: CombinedItem[] = [];

  for (const l of scanned) {
    const calls = scannedCalls[scannedLeadKey(l.id)] ?? [];
    items.push({
      key: `mailin:${l.id}`,
      kind: 'mailin',
      name: l.customerName ?? '',
      store: l.storeNumber ?? '',
      search: [l.customerName, l.phone, l.storeNumber, l.city, l.address].filter(Boolean).join(' ').toLowerCase(),
      date: l.createdAt ? new Date(l.createdAt).getTime() : 0,
      group: scannedGroupKey(l.status, calls),
      node: <ScannedLeadRowItem lead={l} calls={calls} showOffice={showOffice} typeTag={<TypeTag kind="mailin" />} />,
    });
  }

  for (const l of parsed) {
    const calls = parsedCalls[leadKeyOf(l)] ?? [];
    items.push({
      key: `store:${l.rowId}`,
      kind: 'store',
      name: l.customerName ?? '',
      store: l.storeNumber ?? '',
      search: [l.customerName, l.phone, l.storeNumber, l.address, l.email].filter(Boolean).join(' ').toLowerCase(),
      date: l.dateReceived ? new Date(l.dateReceived).getTime() : 0,
      group: storeGroupKey(l, calls),
      node: <StoreLeadRow l={l} calls={calls} storeNames={storeNames} isStaff t={t} typeTag={<TypeTag kind="store" />} />,
    });
  }

  return <CombinedLeadsControls items={items} />;
}

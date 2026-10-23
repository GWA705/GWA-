import { describe, it, expect } from 'vitest';
import { buildDealerMatcher } from '../src/lib/reporting/dealerMatch';

/**
 * The journal's own "Dealer"/office column is the source of truth for who sold a
 * deal — it stays right even after a store changes hands between offices. These
 * tests lock that: a confident office-label match wins over the store-number map,
 * with the store map as the fallback when the label is blank or ambiguous.
 */

const DEALERS = [
  // Platinum was removed from the program and its stores were reassigned to HSP,
  // so Platinum now owns NO stores — only its journal "Dealer" label credits it.
  { id: 'plat', name: 'Platinum Air Care', homeDepotStores: [] },
  { id: 'hsp', name: 'Home Service Providers', homeDepotStores: [{ number: '7237' }, { number: '7182' }] },
  { id: 'bar', name: 'Georgian Water and Air', homeDepotStores: [{ number: '7024' }] },
];

describe('buildDealerMatcher — journal Dealer column wins', () => {
  const match = buildDealerMatcher(DEALERS);

  it('credits Platinum by its journal label even though the store now belongs to HSP', () => {
    // London East 7237 is HSP's store now, but this 2025 row's Dealer column says
    // "Platinum" — so it must credit Platinum, not HSP.
    expect(match({ storeNumber: '7237', location: 'PLATINUM' })).toBe('plat');
    expect(match({ storeNumber: '7182', location: 'Platinum Air Care' })).toBe('plat');
  });

  it("credits HSP for the same store when the row's label is HSP's (or blank)", () => {
    expect(match({ storeNumber: '7237', location: 'Home Service Providers' })).toBe('hsp');
    // Blank label → fall back to the store-number map (HSP owns 7237 now).
    expect(match({ storeNumber: '7237', location: '' })).toBe('hsp');
  });

  it('falls back to the store map when the label is missing', () => {
    expect(match({ storeNumber: '7024', location: '' })).toBe('bar');
    expect(match({ storeNumber: '7024', location: null })).toBe('bar');
  });

  it('matches a label with no store number at all', () => {
    expect(match({ storeNumber: null, location: 'platinum' })).toBe('plat');
  });

  it('returns null when neither label nor store resolves', () => {
    expect(match({ storeNumber: '9999', location: 'Someone Unknown' })).toBeNull();
  });
});

/**
 * Dealer.journalName (Admin → Dealers → Journal name) is an authoritative label
 * for the office. It lets an admin fix a new or oddly-spelled journal label from
 * Admin with no code change — including one whose spelling differs from the
 * dealer's own name (e.g. the journal writes "Nippising", the dealer is named
 * "Nipissing Water and Air").
 */
describe('buildDealerMatcher — Admin journalName drives matching', () => {
  const dealers = [
    { id: 'nip', name: 'Nipissing Water and Air', journalName: 'Nippising', homeDepotStores: [] },
    { id: 'tor', name: 'Toronto Water and Air', journalName: 'TWA, Toronto', homeDepotStores: [] },
  ];
  const match = buildDealerMatcher(dealers);

  it('matches a journal label by the dealer journalName even when it differs from the name', () => {
    expect(match({ storeNumber: null, location: 'NIPPISING' })).toBe('nip');
  });

  it('supports several comma-separated labels on one office', () => {
    expect(match({ storeNumber: null, location: 'TWA' })).toBe('tor');
    expect(match({ storeNumber: null, location: 'Toronto' })).toBe('tor');
  });

  it('still returns null for a label no office claims', () => {
    expect(match({ storeNumber: null, location: 'SIMPLO' })).toBeNull();
  });
});

/**
 * The Brantford case the owner raised: store 7138 moved from Oasis to the
 * Hamilton office (Hydra). The journal's Dealer column labels each row, so the
 * old rows credit Oasis and the new ones credit Hamilton/Hydra — no store-by-store
 * direction needed, even though the store number stays the same throughout.
 */
describe('buildDealerMatcher — a store that changed hands (Brantford: Oasis → Hamilton)', () => {
  const dealers = [
    { id: 'oasis', name: 'Oasis Heating and Cooling', homeDepotStores: [{ number: '7138' }] },
    { id: 'hydra', name: 'Hydra Home Comfort', homeDepotStores: [{ number: '7020' }] },
  ];
  const match = buildDealerMatcher(dealers);

  it('credits Oasis for the old rows and Hamilton/Hydra for the new ones at the same store', () => {
    expect(match({ storeNumber: '7138', location: 'Oasis' })).toBe('oasis');
    // "Hamilton" / "Brantford" are the Hydra office's journal labels (aliases),
    // so a row at Oasis's old store credits Hydra when the label says so.
    expect(match({ storeNumber: '7138', location: 'Hamilton' })).toBe('hydra');
    expect(match({ storeNumber: '7138', location: 'Brantford' })).toBe('hydra');
    // A blank label falls back to the store map (still Oasis's number).
    expect(match({ storeNumber: '7138', location: '' })).toBe('oasis');
  });
});

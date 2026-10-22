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

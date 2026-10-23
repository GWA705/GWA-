import { describe, it, expect } from 'vitest';
import { buildDealerMatcher, type MatchableDealer } from '@/lib/reporting/dealerMatch';

/**
 * Platinum left the Home Depot program and was archived; the three London stores
 * it used to work now belong to the active dealer "Home Service Providers". The
 * matcher must keep Platinum's OWN historical rows with Platinum (they name
 * "Platinum" in the location), while every current London row stays with Home
 * Service Providers — and the fix must never pull a current London row off the
 * live dealer.
 */
const dealers: MatchableDealer[] = [
  { id: 'g', name: 'Georgian Water and Air', homeDepotStores: [{ number: '7024' }], archived: false },
  {
    id: 'hsp',
    name: 'Home Service Providers',
    homeDepotStores: [{ number: '7009' }, { number: '7237' }, { number: '7033' }],
    archived: false,
  },
  // Archived, and deliberately still carrying store 7009 to prove archived stores
  // are NOT registered (they belong to Home Service Providers now).
  { id: 'plat', name: 'Platinum Air Care', homeDepotStores: [{ number: '7009' }], archived: true },
];

const match = buildDealerMatcher(dealers);

describe('buildDealerMatcher — archived-dealer historical attribution', () => {
  it('keeps a Platinum-labelled row with Platinum even when it carries a London store number', () => {
    expect(match({ storeNumber: '7009', location: 'Platinum Air Care' })).toBe('plat');
  });

  it('attributes a Platinum-labelled row with no store to Platinum', () => {
    expect(match({ storeNumber: null, location: 'Platinum' })).toBe('plat');
  });

  it('keeps a current London store row with Home Service Providers (archived 7009 not registered)', () => {
    expect(match({ storeNumber: '7009', location: 'London' })).toBe('hsp');
    expect(match({ storeNumber: '7237', location: '' })).toBe('hsp');
  });

  it('attributes a London location with no store to Home Service Providers via its active alias', () => {
    expect(match({ storeNumber: null, location: 'London' })).toBe('hsp');
  });
});

describe('buildDealerMatcher — active-dealer routing is unchanged', () => {
  it('store number wins', () => {
    expect(match({ storeNumber: '7024', location: '' })).toBe('g');
  });

  it('store number still wins over an active location alias', () => {
    expect(match({ storeNumber: '7009', location: 'Barrie' })).toBe('hsp');
  });

  it('active city alias resolves (Barrie → Georgian)', () => {
    expect(match({ storeNumber: null, location: 'Barrie' })).toBe('g');
  });

  it('returns null when nothing matches', () => {
    expect(match({ storeNumber: '9999', location: 'Nowhere Ontario' })).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { nameTokens } from '@/lib/reporting/dealerSnapshot';

describe('dealer snapshot — location→dealer tokens', () => {
  it('reduces a dealer name to its distinctive word(s)', () => {
    expect(nameTokens('Georgian Water and Air')).toEqual(['georgian']);
    expect(nameTokens('Nipissing Water and Air')).toEqual(['nipissing']);
    expect(nameTokens('Barrie Home Comfort')).toEqual(['barrie']);
    expect(nameTokens('North Bay Mechanical')).toEqual(['north', 'bay']);
  });

  it('keeps distinctive tokens distinct so similar dealers do not collide', () => {
    const georgian = nameTokens('Georgian Water and Air');
    const nipissing = nameTokens('Nipissing Water and Air');
    expect(georgian).not.toEqual(nipissing);
    expect(georgian.some((t) => nipissing.includes(t))).toBe(false);
  });

  it('handles ampersands and punctuation in journal location labels', () => {
    expect(nameTokens('Georgian Water & Air Inc.')).toEqual(['georgian']);
    expect(nameTokens('GWA - Georgian')).toEqual(['georgian']);
  });

  it('returns nothing for a label that is only filler', () => {
    expect(nameTokens('Water and Air')).toEqual([]);
    expect(nameTokens('   ')).toEqual([]);
  });
});

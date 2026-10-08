import { describe, it, expect } from 'vitest';
import { mergeProductsSold } from '@/lib/products';

describe('mergeProductsSold', () => {
  it('combines checked boxes with comma-separated Other entries', () => {
    expect(mergeProductsSold(['WS', 'City'], 'Widget, Gadget')).toEqual(['WS', 'City', 'Widget', 'Gadget']);
  });

  it('trims, collapses whitespace, and drops empties', () => {
    expect(mergeProductsSold(['  WS  '], '  , Foo  Bar ,')).toEqual(['WS', 'Foo Bar']);
  });

  it('de-duplicates the free-text Other field case-insensitively', () => {
    expect(mergeProductsSold(['Angel'], 'angel, ANGEL, New One')).toEqual(['Angel', 'New One']);
  });

  it('KEEPS duplicate picked products (two of the same = quantity 2)', () => {
    expect(mergeProductsSold(['WS', 'WS', 'City'], null)).toEqual(['WS', 'WS', 'City']);
    // the quantity drives the journal UNITS count (3 here)
    expect(mergeProductsSold(['UV12', 'UV12'], 'UV12')).toEqual(['UV12', 'UV12']); // Other dup is ignored, picked dups kept
  });

  it('handles a missing Other field', () => {
    expect(mergeProductsSold(['WS'], null)).toEqual(['WS']);
    expect(mergeProductsSold([], undefined)).toEqual([]);
  });

  it('caps the list at 50 entries', () => {
    const many = Array.from({ length: 60 }, (_, i) => `P${i}`);
    expect(mergeProductsSold(many, null)).toHaveLength(50);
  });
});

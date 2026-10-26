import { describe, it, expect } from 'vitest';
import {
  normProductCode, looseKey, looksSimilar, suggestClusters, makeProductCanon, levenshtein,
} from '@/lib/reporting/productCanon';

describe('product-code canonicalisation', () => {
  it('normalises case + whitespace (conservatively)', () => {
    expect(normProductCode(' ph600 ')).toBe('PH600');
    expect(normProductCode('PH  600')).toBe('PH 600');
    expect(normProductCode('PH600+')).toBe('PH600+'); // suffix kept
  });

  it('looseKey strips punctuation/space for matching', () => {
    expect(looseKey('PH-600')).toBe('PH600');
    expect(looseKey('6 STAGE')).toBe('6STAGE');
  });

  it('looksSimilar catches variants + typos, not different products', () => {
    expect(looksSimilar('PH 600', 'PH600')).toBe(true);        // spacing
    expect(looksSimilar('PH-600', 'PH600')).toBe(true);        // punctuation
    expect(looksSimilar('PH600', 'ELEVATE PH600')).toBe(true); // contained
    expect(looksSimilar('CITY', 'CITYY')).toBe(true);          // one-char typo
    expect(looksSimilar('WS', 'WHCCF')).toBe(false);
    expect(looksSimilar('PH600', 'WCF200')).toBe(false);
  });

  it('clusters group the look-alikes (≥2 only)', () => {
    const clusters = suggestClusters(['PH600', 'PH 600', 'PH-600', 'ELEVATE PH600', 'WS', 'WHCCF', 'CITY', 'CITYY']);
    const ph = clusters.find((c) => c.includes('PH600'))!;
    expect(ph).toEqual(expect.arrayContaining(['PH 600', 'PH-600', 'ELEVATE PH600']));
    const city = clusters.find((c) => c.includes('CITY'))!;
    expect(city).toContain('CITYY');
    expect(clusters.flat()).not.toContain('WS'); // singleton, not a cluster
  });

  it('canon follows the alias map', () => {
    const canon = makeProductCanon({ 'PH 600': 'PH600', 'PH-600': 'PH600', 'ELEVATE PH600': 'PH600' });
    expect(canon('ph 600')).toBe('PH600');
    expect(canon('PH-600')).toBe('PH600');
    expect(canon('WS')).toBe('WS');
  });

  it('levenshtein', () => {
    expect(levenshtein('CITY', 'CITYY')).toBe(1);
    expect(levenshtein('', 'ABC')).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';
import { specialIsLive, mergeSlotImages } from '@/lib/dashboardHero';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`); // midday UTC = same Toronto day
const day = (iso: string) => new Date(`${iso}`); // UTC midnight of that calendar day (as stored)

describe('specialIsLive', () => {
  const s = { startsOn: day('2026-10-24'), endsOn: day('2026-10-31') };
  it('is live within the inclusive window (Toronto)', () => {
    expect(specialIsLive(s, at('2026-10-24'))).toBe(true);
    expect(specialIsLive(s, at('2026-10-28'))).toBe(true);
    expect(specialIsLive(s, at('2026-10-31'))).toBe(true);
  });
  it('is not live before or after', () => {
    expect(specialIsLive(s, at('2026-10-23'))).toBe(false);
    expect(specialIsLive(s, at('2026-11-01'))).toBe(false);
  });
  it('with no dates at all it is always on (runs until turned off)', () => {
    expect(specialIsLive({ startsOn: null, endsOn: null }, at('2026-01-01'))).toBe(true);
    expect(specialIsLive({ startsOn: null, endsOn: null }, at('2026-07-15'))).toBe(true);
  });

  it('a half-set window (only one date) never shows', () => {
    expect(specialIsLive({ startsOn: null, endsOn: day('2026-10-31') }, at('2026-10-25'))).toBe(false);
    expect(specialIsLive({ startsOn: day('2026-10-24'), endsOn: null }, at('2026-10-25'))).toBe(false);
  });
});

describe('mergeSlotImages', () => {
  it('uploaded hero overrides the file default for its slot; others keep the file', () => {
    const files = ['/Hero-12.webp', '/hero-23.webp'];
    const uploaded = { 23: ['/api/dashboard-hero/x/image?v=1'] };
    const merged = mergeSlotImages(files, uploaded);
    expect(merged[12]).toEqual(['/Hero-12.webp']); // file kept
    expect(merged[23]).toEqual(['/api/dashboard-hero/x/image?v=1']); // uploaded wins
    expect(merged[5]).toEqual([]); // no hero for morning
  });
});

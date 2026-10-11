import { describe, it, expect } from 'vitest';
import { pickSpotlight, isoWeekSeed, SPOTLIGHT_DEFAULTS, type SpotlightItem } from '@/lib/marketplaceSpotlight';

const NOW = new Date('2026-10-11T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);

// A catalogue: 2 fresh, 1 pinned-old, plenty of old filler.
function catalogue(): SpotlightItem[] {
  const old: SpotlightItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: `old${i}`,
    createdAt: daysAgo(100 + i),
    featured: false,
    tags: [],
  }));
  return [
    { id: 'fresh1', createdAt: daysAgo(2), featured: false, tags: [] },
    { id: 'fresh2', createdAt: daysAgo(10), featured: false, tags: ['POPULAR'] },
    { id: 'pin1', createdAt: daysAgo(200), featured: true, tags: [] },
    ...old,
  ];
}

const cfg = { enabled: true, targetCount: 6, freshDays: 21 };

describe('isoWeekSeed', () => {
  it('is stable within a week and changes across weeks', () => {
    // ISO weeks run Mon–Sun. 2026-10-12 is Monday, 2026-10-14 Wednesday (same week).
    const a = isoWeekSeed(new Date('2026-10-12T12:00:00Z'));
    const b = isoWeekSeed(new Date('2026-10-14T08:00:00Z')); // same ISO week
    const c = isoWeekSeed(new Date('2026-10-21T12:00:00Z')); // a later week
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('pickSpotlight', () => {
  it('when disabled, shows exactly the admin-featured items', () => {
    const r = pickSpotlight(catalogue(), NOW, { ...cfg, enabled: false });
    expect([...r.ids]).toEqual(['pin1']);
    expect(r.autoNew.size).toBe(0);
  });

  it('always includes fresh and pinned items', () => {
    const r = pickSpotlight(catalogue(), NOW, cfg);
    expect(r.ids.has('fresh1')).toBe(true);
    expect(r.ids.has('fresh2')).toBe(true);
    expect(r.ids.has('pin1')).toBe(true);
  });

  it('fills up to the target count with rotating back-catalogue', () => {
    const r = pickSpotlight(catalogue(), NOW, cfg);
    expect(r.ids.size).toBe(6);
  });

  it('auto-flags fresh items as New, but not ones already tagged NEW', () => {
    const items: SpotlightItem[] = [
      { id: 'a', createdAt: daysAgo(1), featured: false, tags: [] },
      { id: 'b', createdAt: daysAgo(1), featured: false, tags: ['NEW'] },
      { id: 'c', createdAt: daysAgo(90), featured: false, tags: [] },
    ];
    const r = pickSpotlight(items, NOW, cfg);
    expect(r.autoNew.has('a')).toBe(true);
    expect(r.autoNew.has('b')).toBe(false);
    expect(r.autoNew.has('c')).toBe(false);
  });

  it('is deterministic within a week but rotates the filler across weeks', () => {
    const items = catalogue();
    const sameWeek = new Date('2026-10-10T09:00:00Z'); // same ISO week as NOW (both wk 41)
    const nextWeek = new Date('2026-10-14T09:00:00Z'); // following week (wk 42)
    const a = [...pickSpotlight(items, NOW, cfg).ids].sort();
    const b = [...pickSpotlight(items, sameWeek, cfg).ids].sort();
    const c = [...pickSpotlight(items, nextWeek, cfg).ids].sort();
    expect(a).toEqual(b); // same week → same set
    expect(a).not.toEqual(c); // different week → different filler
  });

  it('never hides fresh/pinned even if they exceed the target count', () => {
    const items: SpotlightItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      createdAt: daysAgo(1),
      featured: false,
      tags: [],
    }));
    const r = pickSpotlight(items, NOW, { ...cfg, targetCount: 3 });
    expect(r.ids.size).toBe(10); // all 10 fresh shown despite target 3
  });

  it('shows everything when the catalogue is smaller than the target', () => {
    const items: SpotlightItem[] = [
      { id: 'x', createdAt: daysAgo(90), featured: false, tags: [] },
      { id: 'y', createdAt: daysAgo(90), featured: false, tags: [] },
    ];
    const r = pickSpotlight(items, NOW, cfg);
    expect(r.ids.size).toBe(2);
  });

  it('defaults are sensible', () => {
    expect(SPOTLIGHT_DEFAULTS.enabled).toBe(true);
    expect(SPOTLIGHT_DEFAULTS.targetCount).toBeGreaterThan(0);
  });
});

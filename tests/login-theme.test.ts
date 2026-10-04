import { describe, it, expect } from 'vitest';
import { loginThemeIsLive } from '@/lib/loginTheme';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`); // midday UTC = same Toronto day
const day = (iso: string) => new Date(`${iso}`); // UTC midnight of that calendar day (as stored)

describe('loginThemeIsLive', () => {
  it('a dated theme is live within the inclusive window (Toronto)', () => {
    const t = { startsOn: day('2026-12-20'), endsOn: day('2026-12-26') };
    expect(loginThemeIsLive(t, at('2026-12-20'))).toBe(true);
    expect(loginThemeIsLive(t, at('2026-12-24'))).toBe(true);
    expect(loginThemeIsLive(t, at('2026-12-26'))).toBe(true);
  });

  it('a dated theme is not live before or after', () => {
    const t = { startsOn: day('2026-12-20'), endsOn: day('2026-12-26') };
    expect(loginThemeIsLive(t, at('2026-12-19'))).toBe(false);
    expect(loginThemeIsLive(t, at('2026-12-27'))).toBe(false);
  });

  it('an undated theme is always live (manual always-on)', () => {
    expect(loginThemeIsLive({ startsOn: null, endsOn: null }, at('2026-01-01'))).toBe(true);
    expect(loginThemeIsLive({ startsOn: null, endsOn: null }, at('2026-07-15'))).toBe(true);
  });

  it('a half-set window never shows', () => {
    expect(loginThemeIsLive({ startsOn: day('2026-12-20'), endsOn: null }, at('2026-12-22'))).toBe(false);
    expect(loginThemeIsLive({ startsOn: null, endsOn: day('2026-12-26') }, at('2026-12-22'))).toBe(false);
  });
});

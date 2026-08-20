import { describe, it, expect } from 'vitest';
import { isMiscTab, isMonthTab } from '../src/lib/reporting/journalRead';

describe('isMiscTab', () => {
  it('recognizes the MISC. DEALS/INSTALLS tab and its naming variants', () => {
    expect(isMiscTab('MISC. DEALS/INSTALLS')).toBe(true);
    expect(isMiscTab('12 MISC. DEALS/INSTALLS')).toBe(true);
    expect(isMiscTab('Misc Deals')).toBe(true);
    expect(isMiscTab('Misc. Installs')).toBe(true);
  });

  it('does not treat month tabs or other tabs as MISC', () => {
    expect(isMiscTab('Aug.2026')).toBe(false);
    expect(isMiscTab('August 2026')).toBe(false);
    expect(isMiscTab('Product List')).toBe(false);
    expect(isMiscTab('HD AGREEMENT')).toBe(false);
  });

  it('a MISC tab is never also a month tab', () => {
    expect(isMonthTab('MISC. DEALS/INSTALLS')).toBe(false);
  });
});

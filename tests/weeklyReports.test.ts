import { describe, it, expect } from 'vitest';
import { renderStoreEmailHtml, renderNationalEmailHtml, lastFullWeek } from '@/lib/reporting/weeklyReports';

describe('weekly report rendering', () => {
  it('lastFullWeek returns a Mon–Sun window in the past', () => {
    const w = lastFullWeek(new Date('2026-10-20T12:00:00')); // a Tuesday
    expect(w.start.getDay()).toBe(1); // Monday
    expect(w.end.getDay()).toBe(0); // Sunday
    expect(w.end.getTime()).toBeLessThan(new Date('2026-10-20T12:00:00').getTime());
  });

  it('store email shows the logo, store, totals, and the 701 associate ribbon', () => {
    const html = renderStoreEmailHtml({
      storeNumber: '7024', storeName: 'Barrie', weekLabel: 'Oct 12 – Oct 18, 2026',
      to: ['sm@x.com'], cc: [], needsAssociate: 0, total: 9372.03,
      sales: [
        { hdRef: '701890413', customer: 'Doe, Jane', datePaid: 'Oct 14, 2026', products: 'PH600+', value: 9033.22, is701: true, associateName: 'Jordan M.', associateSource: 'IN_STORE' },
        { hdRef: '800022577', customer: 'Roe, Rick', datePaid: 'Oct 13, 2026', products: 'CITY', value: 338.81, is701: false, associateName: null, associateSource: null },
      ],
    });
    expect(html).toContain('/gwa-logo-dark.png');
    expect(html).toContain('Georgian Water &amp; Air');
    expect(html).toContain('BARRIE');
    expect(html).toContain('ASSOCIATE CREDIT');
    expect(html).toContain('Jordan M.');
    expect(html).toContain('$9,372.03');
    expect(html.startsWith('<!DOCTYPE')).toBe(true);
  });

  it('national email shows district rows, grand total and % change', () => {
    const html = renderNationalEmailHtml({
      weekLabel: 'Oct 12 – Oct 18, 2026', lyLabel: 'Oct 13 – Oct 19, 2025',
      rows: [
        { district: 'Central Ontario', ty: 96135, tyCount: 13, ly: 107299, lyCount: 11, ytdTy: 2492520, ytdLy: 2026000 },
        { district: 'Atlantic Canada', ty: 6795, tyCount: 1, ly: 0, lyCount: 0, ytdTy: 569153, ytdLy: 466000 },
      ],
      totals: { district: 'GRAND TOTAL', ty: 102930, tyCount: 14, ly: 107299, lyCount: 11, ytdTy: 3061673, ytdLy: 2492000 },
    });
    expect(html).toContain('Central Ontario');
    expect(html).toContain('GRAND TOTAL');
    expect(html).toContain('New'); // Atlantic had no LY week
    expect(html).toContain('National Weekly Sales Summary');
  });
});

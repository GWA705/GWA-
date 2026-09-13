import { describe, it, expect } from 'vitest';
import { normalizeRef, storeNumberOf, buildVocBreakdown, extractRefs, REP_UNKNOWN } from '../src/lib/reporting/vocMatch';

describe('extractRefs', () => {
  it('pulls 6-12 digit numbers from free text and de-dupes by digits', () => {
    expect(extractRefs('800237993\n800236265, 701641875')).toEqual(['800237993', '800236265', '701641875']);
    expect(extractRefs('lead 800-237-993 and again 800237993')).toEqual(['800-237-993']); // same digits, first kept
    expect(extractRefs('phone 5551234 but not 12345')).toEqual(['5551234']); // 5 digits dropped
    expect(extractRefs('nothing here')).toEqual([]);
  });
});

describe('normalizeRef', () => {
  it('keeps digits only', () => {
    expect(normalizeRef('800237993')).toBe('800237993');
    expect(normalizeRef(' 701-641875 ')).toBe('701641875');
    expect(normalizeRef(null)).toBe('');
  });
});

describe('storeNumberOf', () => {
  it('pulls the 4-digit HD store number', () => {
    expect(storeNumberOf('WINDSOR-7228')).toBe('7228');
    expect(storeNumberOf('CALGARY SOUTHEAST (MACKENZIE)-7082')).toBe('7082');
    expect(storeNumberOf('no number')).toBeNull();
  });
});

describe('buildVocBreakdown', () => {
  const offices = [
    { dealerId: 'd1', name: 'Windsor Office', storeNumbers: ['7228', '7184'] },
    { dealerId: 'd2', name: 'Calgary Office', storeNumbers: ['7076'] },
  ];
  const deals = [
    { hdRef: '800237993', storeNumber: '7228', salesperson: 'Nick F' },
    { hdRef: '800000002', storeNumber: '7228', salesperson: 'Nick.f' }, // near-dup of Nick F
    { hdRef: '800000003', storeNumber: '7184', salesperson: 'Aaron' },
    { hdRef: '701641875', storeNumber: '7076', salesperson: 'James' },
  ];

  it('groups by office and rep, merges near-duplicate rep names, and reports match rate', () => {
    const vocs = [
      { leadRef: '800237993', storeNumber: '7228', overallRating: 5 }, // Nick F, Windsor
      { leadRef: '800000002', storeNumber: '7228', overallRating: 4 }, // Nick.f -> merges with Nick F
      { leadRef: '800000003', storeNumber: '7184', overallRating: 5 }, // Aaron, Windsor
      { leadRef: '701641875', storeNumber: '7076', overallRating: 3 }, // James, Calgary
      { leadRef: '999999999', storeNumber: '7228', overallRating: 5 }, // no journal match -> Windsor, rep unknown
    ];
    const r = buildVocBreakdown({ vocs, deals, offices });
    expect(r.totalVocs).toBe(5);
    expect(r.matchedToRep).toBe(4);
    expect(r.matchRatePct).toBe(80);

    const windsor = r.offices.find((o) => o.dealerId === 'd1')!;
    expect(windsor.total).toBe(4);
    // Nick F + Nick.f merged into one rep with count 2
    const nick = windsor.reps.find((x) => x.count === 2 && x.matched)!;
    expect(nick).toBeTruthy();
    expect(['Nick F', 'Nick.f']).toContain(nick.rep);
    // unknown bucket present, sorts last, count 1
    const unknown = windsor.reps.find((x) => !x.matched)!;
    expect(unknown.rep).toBe(REP_UNKNOWN);
    expect(unknown.count).toBe(1);
    expect(windsor.reps[windsor.reps.length - 1].matched).toBe(false);

    const calgary = r.offices.find((o) => o.dealerId === 'd2')!;
    expect(calgary.total).toBe(1);
    expect(calgary.reps[0].rep).toBe('James');
  });

  it('sends VOCs with an unknown store to an Unassigned office', () => {
    const vocs = [{ leadRef: 'x', storeNumber: '9999', overallRating: 5 }];
    const r = buildVocBreakdown({ vocs, deals, offices });
    expect(r.offices).toHaveLength(1);
    expect(r.offices[0].dealerId).toBeNull();
    expect(r.offices[0].office).toBe('Unassigned');
  });

  it('falls back to the matched deal store when the VOC store is missing', () => {
    const vocs = [{ leadRef: '800237993', storeNumber: null, overallRating: 5 }];
    const r = buildVocBreakdown({ vocs, deals, offices });
    expect(r.offices[0].dealerId).toBe('d1');
  });

  it('restrictDealerIds keeps only that office and drops Unassigned', () => {
    const vocs = [
      { leadRef: '800237993', storeNumber: '7228', overallRating: 5 }, // Windsor
      { leadRef: '701641875', storeNumber: '7076', overallRating: 5 }, // Calgary
      { leadRef: 'x', storeNumber: '0000', overallRating: 5 }, // Unassigned
    ];
    const r = buildVocBreakdown({ vocs, deals, offices }, { restrictDealerIds: ['d1'] });
    expect(r.offices).toHaveLength(1);
    expect(r.offices[0].dealerId).toBe('d1');
    expect(r.totalVocs).toBe(1);
    expect(r.matchRatePct).toBe(100);
  });
});

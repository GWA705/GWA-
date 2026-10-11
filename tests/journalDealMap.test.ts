import { describe, it, expect } from 'vitest';
import {
  journalMatchKey,
  parseJournalMatchKey,
  queryNameTokens,
  phoneLast10,
  journalDealMatches,
  inferProgramCategory,
  paymentMethodFromBucket,
  splitProducts,
  journalDealNote,
  journalDealLabel,
  type JournalDealLike,
} from '@/lib/journalDealMap';

function deal(overrides: Partial<JournalDealLike> = {}): JournalDealLike {
  return {
    year: 2026,
    tab: 'August 2026',
    rowNum: 42,
    firstName: 'Farrukh',
    lastName: 'Khan',
    phone: '(705) 555-0199',
    address: '12 Scott St, Barrie',
    hdRef: '8001234567',
    hdStore: 'BARRIE - 7024',
    storeNumber: '7024',
    location: 'Georgian Water & Air',
    product: 'Water softener + RO drinking system',
    salesperson: 'Dana R.',
    isHD: true,
    result: 'OK',
    gross: 5650,
    netToGWA: 1200,
    date: new Date(2026, 7, 15),
    datePaid: new Date(2026, 7, 28),
    financeBucket: 'HDFINIT',
    linkUrl: 'https://docs.google.com/spreadsheets/d/x/edit#gid=1&range=A42',
    ...overrides,
  };
}

describe('journalMatchKey / parseJournalMatchKey', () => {
  it('round-trips a key', () => {
    const d = deal();
    const key = journalMatchKey(d);
    expect(key).toBe('2026::August 2026::42');
    expect(parseJournalMatchKey(key)).toEqual({ year: 2026, tab: 'August 2026', rowNum: 42 });
  });

  it('rejects malformed keys', () => {
    expect(parseJournalMatchKey('')).toBeNull();
    expect(parseJournalMatchKey('2026::only-two')).toBeNull();
    expect(parseJournalMatchKey('notayear::tab::1')).toBeNull();
    expect(parseJournalMatchKey('2026::tab::notarow')).toBeNull();
  });
});

describe('queryNameTokens / phoneLast10', () => {
  it('keeps name tokens, drops numbers and short bits', () => {
    expect(queryNameTokens('Farrukh Khan 42 a')).toEqual(['farrukh', 'khan']);
  });
  it('takes the last 10 digits once there are at least 7', () => {
    expect(phoneLast10('+1 (705) 555-0199')).toBe('7055550199');
    expect(phoneLast10('555-0199')).toBe('5550199');
    expect(phoneLast10('12345')).toBe('');
  });
});

describe('journalDealMatches', () => {
  it('matches on phone last-10 regardless of formatting', () => {
    expect(journalDealMatches(deal(), [], '7055550199')).toBe(true);
    expect(journalDealMatches(deal({ phone: '705.555.0199' }), [], '7055550199')).toBe(true);
  });
  it('matches when every name token hits first or last name', () => {
    expect(journalDealMatches(deal(), ['farr'], '')).toBe(true);
    expect(journalDealMatches(deal(), ['farrukh', 'khan'], '')).toBe(true);
    expect(journalDealMatches(deal(), ['smith'], '')).toBe(false);
  });
  it('does not match on an empty query', () => {
    expect(journalDealMatches(deal(), [], '')).toBe(false);
  });
  it('requires ALL tokens (AND), not any', () => {
    expect(journalDealMatches(deal(), ['farrukh', 'smith'], '')).toBe(false);
  });
});

describe('inferProgramCategory', () => {
  it('defaults to WATER', () => {
    expect(inferProgramCategory('Water softener')).toBe('WATER');
    expect(inferProgramCategory('')).toBe('WATER');
  });
  it('detects air/hvac/smell busters', () => {
    expect(inferProgramCategory('Air purifier')).toBe('AIR');
    expect(inferProgramCategory('HVAC furnace install')).toBe('HVAC');
    expect(inferProgramCategory('Smell Busters unit')).toBe('SMELL_BUSTERS');
  });
});

describe('paymentMethodFromBucket', () => {
  it('maps the common buckets', () => {
    expect(paymentMethodFromBucket('HDFINIT')).toBe('FINANCEIT');
    expect(paymentMethodFromBucket('GHSFINIT')).toBe('FINANCEIT');
    expect(paymentMethodFromBucket('HDCC')).toBe('HD_CREDIT_CARD');
    expect(paymentMethodFromBucket('Credit Card')).toBe('CREDIT_CARD');
    expect(paymentMethodFromBucket('Cash/Cheque/Etransfer')).toBe('CASH');
    expect(paymentMethodFromBucket('Enercare')).toBe('FINANCE_COMPANY');
  });
  it('returns null for unknown/other', () => {
    expect(paymentMethodFromBucket('Unknown')).toBeNull();
    expect(paymentMethodFromBucket('')).toBeNull();
    expect(paymentMethodFromBucket('Something else')).toBeNull();
  });
});

describe('splitProducts', () => {
  it('splits on common separators and trims', () => {
    expect(splitProducts('Water softener + RO drinking system')).toEqual([
      'Water softener',
      'RO drinking system',
    ]);
    expect(splitProducts('Softener, RO; UV and filter')).toEqual([
      'Softener',
      'RO',
      'UV',
      'filter',
    ]);
  });
  it('returns empty array for blank', () => {
    expect(splitProducts('')).toEqual([]);
  });
});

describe('journalDealNote / journalDealLabel', () => {
  it('note includes provenance, money and the journal link', () => {
    const note = journalDealNote(deal());
    expect(note).toContain('2026 sales journal');
    expect(note).toContain('August 2026, row 42');
    expect(note).toContain('Farrukh Khan');
    expect(note).toContain('HD Ref 8001234567');
    expect(note).toContain('Dana R.');
    expect(note).toContain('HDFINIT');
    expect(note).toContain('docs.google.com');
  });
  it('label is a compact one-liner', () => {
    const label = journalDealLabel(deal());
    expect(label).toContain('HD');
    expect(label).toContain('#8001234567');
    expect(label).toContain('Water softener');
  });
});

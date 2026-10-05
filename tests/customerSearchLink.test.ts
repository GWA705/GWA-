import { describe, it, expect } from 'vitest';
import { normLastName, pickLinkedApp, type LinkCandidate } from '../src/lib/customerSearchLink';

const cand = (id: string, applicantLastName: string, applicantEmail: string | null = null): LinkCandidate => ({
  id,
  applicantLastName,
  applicantEmail,
});

describe('normLastName', () => {
  it('lowercases and strips non-letters', () => {
    expect(normLastName('  RIAZ ')).toBe('riaz');
    expect(normLastName("O'Brien")).toBe('obrien');
    expect(normLastName('Smith-Jones')).toBe('smithjones');
  });
  it('is empty for blank / null', () => {
    expect(normLastName('')).toBe('');
    expect(normLastName(null)).toBe('');
    expect(normLastName('   ')).toBe('');
  });
});

describe('pickLinkedApp', () => {
  it('links only a deal whose last name matches the journal row', () => {
    // The bug: a deal mis-pointed at this row (different customer) must NOT link,
    // or it bleeds its email/contact into the row.
    const candidates = [cand('mehrdad', 'Soleimani', 'mehrdad.smn@gmail.com'), cand('farrukh', 'Riaz', 'farrukh@example.com')];
    const picked = pickLinkedApp(candidates, 'RIAZ');
    expect(picked?.id).toBe('farrukh');
    expect(picked?.applicantEmail).toBe('farrukh@example.com');
  });

  it('returns null when no candidate matches the row name', () => {
    const candidates = [cand('mehrdad', 'Soleimani', 'mehrdad.smn@gmail.com')];
    expect(pickLinkedApp(candidates, 'Riaz')).toBeNull();
  });

  it('is deterministic: newest-first wins among same-name matches', () => {
    // Caller passes candidates ordered newest-first; the first match must win
    // every time, so the same search never flips between duplicates.
    const candidates = [cand('newest', 'Riaz', 'new@example.com'), cand('older', 'Riaz', 'old@example.com')];
    expect(pickLinkedApp(candidates, 'Riaz')?.id).toBe('newest');
    // Order preserved → same result on a repeat call.
    expect(pickLinkedApp(candidates, 'Riaz')?.id).toBe('newest');
  });

  it('does not link when the row has no usable last name', () => {
    const candidates = [cand('farrukh', 'Riaz')];
    expect(pickLinkedApp(candidates, '')).toBeNull();
    expect(pickLinkedApp(candidates, '   ')).toBeNull();
  });

  it('matches regardless of case / punctuation differences', () => {
    const candidates = [cand('a', "o'brien", 'a@example.com')];
    expect(pickLinkedApp(candidates, 'OBrien')?.id).toBe('a');
  });
});

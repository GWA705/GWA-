import { describe, it, expect } from 'vitest';
import { sectionsBlockingSubmit } from '../src/lib/scanReview';

const ORDER = ['applicant', 'address', 'employment', 'coApplicant'] as const;

describe('sectionsBlockingSubmit', () => {
  const allVisible = () => true;

  it('blocks on a scanned section that is on screen and not yet confirmed', () => {
    const review = new Set(['applicant']);
    const confirmed = new Set<string>();
    expect(sectionsBlockingSubmit(ORDER, review, confirmed, allVisible)).toEqual(['applicant']);
  });

  it('does not block once the section is confirmed', () => {
    const review = new Set(['applicant']);
    const confirmed = new Set(['applicant']);
    expect(sectionsBlockingSubmit(ORDER, review, confirmed, allVisible)).toEqual([]);
  });

  it('NEVER blocks on a section that is not on screen (the DOB/Express bug)', () => {
    // A full credit-app scan flagged employment, but Express/Photo never render
    // the employment section — so it has no checkbox to tick and must not block.
    const review = new Set(['applicant', 'address', 'employment']);
    const confirmed = new Set(['applicant', 'address']);
    const visible = (k: string) => k !== 'employment';
    expect(sectionsBlockingSubmit(ORDER, review, confirmed, visible)).toEqual([]);
  });

  it('does not block on a co-applicant stranded by a method switch', () => {
    const review = new Set(['coApplicant']);
    const confirmed = new Set<string>();
    const visible = (k: string) => k !== 'coApplicant';
    expect(sectionsBlockingSubmit(ORDER, review, confirmed, visible)).toEqual([]);
  });

  it('returns unconfirmed visible sections in top-to-bottom order', () => {
    const review = new Set(['coApplicant', 'applicant', 'employment']);
    const confirmed = new Set<string>();
    expect(sectionsBlockingSubmit(ORDER, review, confirmed, allVisible)).toEqual([
      'applicant',
      'employment',
      'coApplicant',
    ]);
  });
});

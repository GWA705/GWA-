import { describe, it, expect } from 'vitest';
import {
  currentPhaseIndex,
  reviewerPhaseStates,
  dealerFacingStatus,
  REVIEWER_PHASES,
  type FlowSignals,
} from '@/lib/reviewerFlow';

const base: FlowSignals = {
  status: 'SUBMITTED',
  reviewerDocsSent: false,
  fundingDocsReceived: false,
  hasPayouts: false,
};

describe('currentPhaseIndex', () => {
  it('new/under-review deals are in phase 1 (decide)', () => {
    expect(currentPhaseIndex({ ...base, status: 'SUBMITTED' })).toBe(1);
    expect(currentPhaseIndex({ ...base, status: 'UNDER_REVIEW' })).toBe(1);
  });

  it('approved with nothing sent yet is producing documents (phase 2)', () => {
    expect(currentPhaseIndex({ ...base, status: 'APPROVED' })).toBe(2);
  });

  it('approved once paperwork is out is awaiting install (phase 3)', () => {
    expect(currentPhaseIndex({ ...base, status: 'APPROVED', reviewerDocsSent: true })).toBe(3);
  });

  it('DOCS_SENT is awaiting install (phase 3), or review if the package is already back', () => {
    expect(currentPhaseIndex({ ...base, status: 'DOCS_SENT' })).toBe(3);
    expect(currentPhaseIndex({ ...base, status: 'DOCS_SENT', fundingDocsReceived: true })).toBe(4);
    expect(dealerFacingStatus({ ...base, status: 'DOCS_SENT' })).toBe('Awaiting your signed documents');
  });

  it('dealer returning the signed package jumps to review (phase 4)', () => {
    expect(currentPhaseIndex({ ...base, status: 'APPROVED', reviewerDocsSent: true, fundingDocsReceived: true })).toBe(4);
    expect(currentPhaseIndex({ ...base, status: 'FUNDING_SUBMITTED' })).toBe(4);
  });

  it('in-for-funding sits at phase 6 until paid', () => {
    expect(currentPhaseIndex({ ...base, status: 'FUNDING_REVIEW' })).toBe(6);
    expect(currentPhaseIndex({ ...base, status: 'FUNDING_REVIEW', hasPayouts: true })).toBe(7);
  });

  it('funded is the pay phase (7)', () => {
    expect(currentPhaseIndex({ ...base, status: 'FUNDED' })).toBe(7);
  });
});

describe('reviewerPhaseStates', () => {
  it('marks earlier phases done, current now, later todo', () => {
    const states = reviewerPhaseStates({ ...base, status: 'FUNDING_SUBMITTED' }); // phase 4
    expect(states.map((s) => s.state)).toEqual(['done', 'done', 'done', 'now', 'todo', 'todo', 'todo']);
  });

  it('returns all seven phases in order', () => {
    expect(reviewerPhaseStates(base)).toHaveLength(REVIEWER_PHASES.length);
  });
});

describe('dealerFacingStatus', () => {
  it('gives a plain-language label per phase', () => {
    expect(dealerFacingStatus({ ...base, status: 'SUBMITTED' })).toBe('Under review');
    expect(dealerFacingStatus({ ...base, status: 'APPROVED' })).toBe('Approved — preparing your documents');
    expect(dealerFacingStatus({ ...base, status: 'FUNDING_SUBMITTED' })).toBe('Reviewing your documents');
    expect(dealerFacingStatus({ ...base, status: 'FUNDING_REVIEW' })).toBe('In for funding');
  });

  it('has dedicated wording for off-path states', () => {
    expect(dealerFacingStatus({ ...base, status: 'DECLINED' })).toBe('Declined');
    expect(dealerFacingStatus({ ...base, status: 'PROBLEM' })).toBe('On hold — we need something from you');
  });
});

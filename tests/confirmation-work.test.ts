import { describe, it, expect } from 'vitest';
import {
  confirmationCheckedCount,
  confirmationChecksRemaining,
  confirmationEligible,
  confirmationWorkState,
  flowSignalsFor,
  isOutstanding,
  CONFIRMATION_CHECK_COUNT,
} from '@/lib/confirmationWork';
import type { FlowSignals } from '@/lib/reviewerFlow';

const base: FlowSignals = {
  status: 'SUBMITTED',
  reviewerDocsSent: false,
  fundingDocsReceived: false,
  hasPayouts: false,
};

const allChecks = {
  installedWorking: true,
  performingAsRepresented: true,
  receivedEverything: true,
  termsAgreed: true,
  signatureConfirmed: true,
  notTrialOffer: true,
};

describe('confirmationCheckedCount', () => {
  it('counts the six checks; null record is zero', () => {
    expect(confirmationCheckedCount(null)).toBe(0);
    expect(confirmationCheckedCount(undefined)).toBe(0);
    expect(confirmationCheckedCount({ installedWorking: true, termsAgreed: true })).toBe(2);
    expect(confirmationCheckedCount(allChecks)).toBe(CONFIRMATION_CHECK_COUNT);
    // Nulls/false don't count.
    expect(confirmationCheckedCount({ installedWorking: true, performingAsRepresented: null, receivedEverything: false })).toBe(1);
  });
});

describe('confirmationChecksRemaining', () => {
  it('lists the outstanding checks in call order', () => {
    expect(confirmationChecksRemaining(allChecks)).toEqual([]);
    expect(confirmationChecksRemaining(null)).toHaveLength(CONFIRMATION_CHECK_COUNT);
    expect(confirmationChecksRemaining({ installedWorking: true, performingAsRepresented: true, receivedEverything: true })).toEqual([
      'terms agreed',
      'signature confirmed',
      'not a trial offer',
    ]);
  });
});

describe('confirmationEligible', () => {
  it('is false before the review stage, true once the signed package is back', () => {
    expect(confirmationEligible({ ...base, status: 'SUBMITTED' })).toBe(false);
    expect(confirmationEligible({ ...base, status: 'APPROVED', reviewerDocsSent: true })).toBe(false); // phase 3 (awaiting install)
    expect(confirmationEligible({ ...base, status: 'APPROVED', reviewerDocsSent: true, fundingDocsReceived: true })).toBe(true); // phase 4
    expect(confirmationEligible({ ...base, status: 'FUNDING_SUBMITTED', reviewerDocsSent: true })).toBe(true);
    expect(confirmationEligible({ ...base, status: 'FUNDING_REVIEW' })).toBe(true);
    expect(confirmationEligible({ ...base, status: 'FUNDED' })).toBe(true);
  });
});

describe('confirmationWorkState', () => {
  it('ISSUE and DONE show regardless of eligibility', () => {
    expect(confirmationWorkState({ confirmationStatus: 'ISSUE', eligible: false, checked: 0 })).toBe('ISSUE');
    expect(confirmationWorkState({ confirmationStatus: 'COMPLETED', eligible: false, checked: 6 })).toBe('DONE');
  });

  it('a pending, not-yet-eligible deal is NOT on the worklist', () => {
    expect(confirmationWorkState({ confirmationStatus: 'PENDING', eligible: false, checked: 0 })).toBeNull();
  });

  it('eligible + pending is NEEDS_CALL, or IN_PROGRESS once a check is done', () => {
    expect(confirmationWorkState({ confirmationStatus: 'PENDING', eligible: true, checked: 0 })).toBe('NEEDS_CALL');
    expect(confirmationWorkState({ confirmationStatus: 'PENDING', eligible: true, checked: 3 })).toBe('IN_PROGRESS');
  });
});

describe('flowSignalsFor + the full eligibility path', () => {
  it('a Funded deal with the package back is eligible and needs a call when untouched', () => {
    const docs = [
      { stage: 'REVIEWER', createdAt: new Date('2026-01-10T12:00:00Z') },
      { stage: 'FUNDING', createdAt: new Date('2026-01-11T12:00:00Z') },
    ];
    const signals = flowSignalsFor('FUNDED', docs, 0);
    const state = confirmationWorkState({
      confirmationStatus: 'PENDING',
      eligible: confirmationEligible(signals),
      checked: confirmationCheckedCount(null),
    });
    expect(state).toBe('NEEDS_CALL');
  });
});

describe('isOutstanding', () => {
  it('counts needs-call / in-progress / issue, not done', () => {
    expect(isOutstanding('NEEDS_CALL')).toBe(true);
    expect(isOutstanding('IN_PROGRESS')).toBe(true);
    expect(isOutstanding('ISSUE')).toBe(true);
    expect(isOutstanding('DONE')).toBe(false);
  });
});

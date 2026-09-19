import { describe, it, expect } from 'vitest';
import { dealProgress, currentStageIndex, type ProgressSignals } from '@/lib/progress';

const base: ProgressSignals = {
  status: 'SUBMITTED',
  confirmationStatus: 'PENDING',
  hasFundingDocs: false,
  hasPayouts: false,
  journalPaidOn: null,
};

// The label of the stage the tracker highlights as "current" for a set of signals.
function currentLabel(s: ProgressSignals): string {
  const stages = dealProgress(s);
  const i = currentStageIndex(stages);
  return i === -1 ? 'Complete' : stages[i].label;
}

describe('dealProgress — current stage sits on where the deal actually is', () => {
  it('a just-submitted deal (option 2/3) rests on "Submitted" until approved', () => {
    expect(currentLabel({ ...base, status: 'SUBMITTED' })).toBe('Submitted');
    expect(currentLabel({ ...base, status: 'UNDER_REVIEW' })).toBe('Submitted');
  });

  it('a freshly approved deal (option 1 / instant-approved) rests on "Approved", not "Docs uploaded"', () => {
    expect(currentLabel({ ...base, status: 'APPROVED' })).toBe('Approved');
    expect(currentLabel({ ...base, status: 'CONDITIONAL' })).toBe('Approved');
  });

  it('once install paperwork is out (DOCS_SENT) the current stage is "Docs uploaded"', () => {
    expect(currentLabel({ ...base, status: 'DOCS_SENT' })).toBe('Docs uploaded');
  });

  it('advances past "Approved" once the dealer\'s funding docs are in', () => {
    expect(currentLabel({ ...base, status: 'APPROVED', hasFundingDocs: true })).toBe('Confirmation');
  });

  it('a signed package received (FUNDING_SUBMITTED) is at "Confirmation"', () => {
    expect(currentLabel({ ...base, status: 'FUNDING_SUBMITTED' })).toBe('Confirmation');
  });

  it('later stages (unchanged) still resolve: funded-not-paid rests on "Paid", paid is complete', () => {
    // Realistic signals for a funded deal: the confirmation call is done by now.
    const funded: ProgressSignals = { ...base, status: 'FUNDED', confirmationStatus: 'COMPLETED' };
    expect(currentLabel(funded)).toBe('Paid');
    expect(currentLabel({ ...funded, hasPayouts: true })).toBe('Complete');
  });
});

describe('dealProgress — stage done flags', () => {
  it('does not mark "Submitted"/"Approved" done while the deal is still submitted', () => {
    const stages = dealProgress({ ...base, status: 'SUBMITTED' });
    const done = Object.fromEntries(stages.map((st) => [st.key, st.done]));
    expect(done.submitted).toBe(false);
    expect(done.approved).toBe(false);
    expect(done.docs).toBe(false);
  });

  it('marks "Submitted" done but "Approved" current for a freshly approved deal', () => {
    const stages = dealProgress({ ...base, status: 'APPROVED' });
    const done = Object.fromEntries(stages.map((st) => [st.key, st.done]));
    expect(done.submitted).toBe(true);
    expect(done.approved).toBe(false);
  });
});

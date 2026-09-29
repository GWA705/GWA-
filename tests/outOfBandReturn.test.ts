import { describe, it, expect } from 'vitest';
import type { ApplicationStatus, DocumentType } from '@prisma/client';
import { installDocsEverSent, isOutOfBandReturn } from '@/lib/outOfBandReturn';

const S = (...s: ApplicationStatus[]): ApplicationStatus[] => s;
const D = (...d: DocumentType[]): DocumentType[] => d;

describe('installDocsEverSent', () => {
  it('true when the deal ever reached DOCS_SENT or beyond', () => {
    expect(installDocsEverSent(S('SUBMITTED', 'APPROVED', 'DOCS_SENT'))).toBe(true);
    expect(installDocsEverSent(S('FUNDING_REVIEW'))).toBe(true);
  });
  it('false when never reached DOCS_SENT (even if the reviewer produced docs and emailed them)', () => {
    expect(installDocsEverSent(S('SUBMITTED', 'APPROVED', 'CONDITIONAL'))).toBe(false);
  });
});

describe('isOutOfBandReturn', () => {
  const base = {
    status: 'APPROVED' as ApplicationStatus,
    fundingDocTypes: D('SIGNED_HD_DOCUMENT'),
    statusHistoryTos: S('SUBMITTED', 'APPROVED'),
  };

  it('true: package returned, still approved, never reached DOCS_SENT', () => {
    expect(isOutOfBandReturn({ ...base })).toBe(true);
  });

  it('true even though the reviewer produced install docs — if they were emailed (never DOCS_SENT)', () => {
    // Darcy case: install docs produced then handled out-of-band, status stayed Approved.
    expect(isOutOfBandReturn({ ...base, statusHistoryTos: S('SUBMITTED', 'APPROVED') })).toBe(true);
  });

  it('FALSE when the deal reached DOCS_SENT and was moved back to Conditional (sent in-portal)', () => {
    expect(isOutOfBandReturn({ ...base, status: 'CONDITIONAL', statusHistoryTos: S('APPROVED', 'DOCS_SENT', 'CONDITIONAL') })).toBe(false);
  });

  it('FALSE past the pre-send stage (already submitted / funding)', () => {
    expect(isOutOfBandReturn({ ...base, status: 'FUNDING_SUBMITTED' })).toBe(false);
  });

  it('FALSE for a benign early void cheque / other (not a package-return type)', () => {
    expect(isOutOfBandReturn({ ...base, fundingDocTypes: D('VOID_CHEQUE_OR_PAP') })).toBe(false);
    expect(isOutOfBandReturn({ ...base, fundingDocTypes: D('OTHER') })).toBe(false);
  });
});

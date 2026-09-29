import { describe, it, expect } from 'vitest';
import type { ApplicationStatus, DocumentType } from '@prisma/client';
import { installDocsEverSent, isOutOfBandReturn } from '@/lib/outOfBandReturn';

const S = (...s: ApplicationStatus[]): ApplicationStatus[] => s;
const D = (...d: DocumentType[]): DocumentType[] => d;

describe('installDocsEverSent', () => {
  it('true when the reviewer produced install docs', () => {
    expect(installDocsEverSent(1, [])).toBe(true);
  });
  it('true when the deal ever reached DOCS_SENT or beyond', () => {
    expect(installDocsEverSent(0, S('SUBMITTED', 'APPROVED', 'DOCS_SENT'))).toBe(true);
    expect(installDocsEverSent(0, S('FUNDING_REVIEW'))).toBe(true);
  });
  it('false when never sent', () => {
    expect(installDocsEverSent(0, S('SUBMITTED', 'APPROVED', 'CONDITIONAL'))).toBe(false);
  });
});

describe('isOutOfBandReturn', () => {
  const base = {
    status: 'APPROVED' as ApplicationStatus,
    fundingDocTypes: D('SIGNED_HD_DOCUMENT'),
    reviewerDocCount: 0,
    statusHistoryTos: S('SUBMITTED', 'APPROVED'),
  };

  it('true: package returned, still approved, install docs never sent', () => {
    expect(isOutOfBandReturn({ ...base })).toBe(true);
  });

  it('FALSE when install docs were sent in-portal (reviewer docs exist) — the reported false positive', () => {
    expect(isOutOfBandReturn({ ...base, reviewerDocCount: 2 })).toBe(false);
  });

  it('FALSE when the deal reached DOCS_SENT and was moved back to Conditional', () => {
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

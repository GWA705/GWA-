import { describe, it, expect } from 'vitest';
import { fundingDocumentTypesFor, FUNDING_DOCUMENT_TYPES } from '../src/lib/constants';

describe('fundingDocumentTypesFor', () => {
  it('keeps the full checklist (incl. HD paperwork + waiver) for HD deals', () => {
    const types = fundingDocumentTypesFor('HD').map((t) => t.type);
    expect(types).toContain('SIGNED_HD_DOCUMENT');
    expect(types).toContain('HD_WAIVER');
    expect(types).toEqual(FUNDING_DOCUMENT_TYPES.map((t) => t.type));
  });

  it('drops HD paperwork + waiver for GWA deals', () => {
    const types = fundingDocumentTypesFor('GWA').map((t) => t.type);
    expect(types).not.toContain('SIGNED_HD_DOCUMENT');
    expect(types).not.toContain('HD_WAIVER');
  });

  it('still requires the non-HD funding docs for GWA deals', () => {
    const types = fundingDocumentTypesFor('GWA').map((t) => t.type);
    expect(types).toContain('SIGNED_CONTRACT');
    expect(types).toContain('VOID_CHEQUE_OR_PAP');
    expect(types).toContain('INSTALL_PHOTO');
  });

  it('drops finance docs + void/PAP for an already-paid Express deal (credit card)', () => {
    const types = fundingDocumentTypesFor('HD', { paymentMethod: 'CREDIT_CARD' }).map((t) => t.type);
    expect(types).not.toContain('SIGNED_CONTRACT');
    expect(types).not.toContain('VOID_CHEQUE_OR_PAP');
    // Non-financed items are unaffected.
    expect(types).toContain('INSTALL_PHOTO');
    expect(types).toContain('SIGNED_HD_DOCUMENT');
  });

  it('drops them for cash and cheque too', () => {
    for (const pm of ['CASH', 'CHEQUE', 'HD_CREDIT_CARD'] as const) {
      const types = fundingDocumentTypesFor('HD', { paymentMethod: pm }).map((t) => t.type);
      expect(types).not.toContain('SIGNED_CONTRACT');
      expect(types).not.toContain('VOID_CHEQUE_OR_PAP');
    }
  });

  it('keeps finance docs for FinanceIT and for split-payment deals', () => {
    const financeit = fundingDocumentTypesFor('HD', { paymentMethod: 'FINANCEIT' }).map((t) => t.type);
    expect(financeit).toContain('SIGNED_CONTRACT');
    expect(financeit).toContain('VOID_CHEQUE_OR_PAP');
    // A split deal with a non-finance method still has a financed portion.
    const split = fundingDocumentTypesFor('HD', { paymentMethod: 'CREDIT_CARD', isSplitPayment: true }).map((t) => t.type);
    expect(split).toContain('SIGNED_CONTRACT');
    expect(split).toContain('VOID_CHEQUE_OR_PAP');
  });
});

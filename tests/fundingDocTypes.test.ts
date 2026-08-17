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
});

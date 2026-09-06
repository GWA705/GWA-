import type { TFunction } from '@/i18n/translator';
import type { ProgramType, ProgramCategory, PaymentMethod, DocumentType } from '@prisma/client';

/**
 * Locale-aware, DISPLAY-ONLY labels for the deal enums (program type/category,
 * payment method, SOAP). These mirror the English constants in `constants.ts`
 * but resolve through the active dictionary so the UI can show fr-CA.
 *
 * IMPORTANT: use these ONLY for on-screen display. Anything written to an
 * external system — the sales journal, CSV/PDF exports, HD paperwork, emails —
 * must keep using the plain English constants in `constants.ts`, so records stay
 * consistent regardless of the viewer's language.
 */

export const programTypeLabel = (t: TFunction, v: ProgramType): string => t(`enum.programType.${v}`);

export const programCategoryLabel = (t: TFunction, v: ProgramCategory): string => t(`enum.programCategory.${v}`);

/** "HD · Water" style combined label, localized. Mirrors constants.programLabel. */
export const programDisplayLabel = (t: TFunction, type: ProgramType, category: ProgramCategory): string =>
  `${programTypeLabel(t, type)} · ${programCategoryLabel(t, category)}`;

export const paymentMethodLabel = (t: TFunction, v: PaymentMethod): string => t(`enum.paymentMethod.${v}`);

/** Localized funding-document type label (display only). Mirrors the English
 *  labels in constants.FUNDING_DOCUMENT_TYPES, which stay the source of truth
 *  for anything written to a record. */
export const fundingDocTypeLabel = (t: TFunction, v: DocumentType): string => t(`enum.fundingDocType.${v}`);

/** Localized recorded-decision label (APPROVE/CONDITIONAL/…). Display only. */
export const decisionDisplayLabel = (t: TFunction, type: string): string =>
  ['APPROVE', 'CONDITIONAL', 'REQUEST_DOCS', 'DECLINE', 'FUND'].includes(type)
    ? t(`enum.decision.${type}`)
    : type.replace(/_/g, ' ').toLowerCase();

/**
 * Localized SOAP display label. Mirrors constants.soapLabel: prefers the
 * specific variant, else the legacy Yes/No boolean; returns null when unknown.
 */
export function soapDisplayLabel(t: TFunction, soapType?: string | null, soapIncluded?: boolean | null): string | null {
  if (soapType) {
    const key = ['NO', 'NV', 'PS', 'OTHER'].includes(soapType) ? `enum.soap.${soapType}` : 'enum.soap.yes';
    return t(key);
  }
  if (soapIncluded == null) return null;
  return soapIncluded ? t('enum.soap.yes') : t('enum.soap.NO');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { canAccessApplication } from '@/lib/rbac';
import { encryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { storeUploadedFile } from '@/lib/upload';
import { applicationSchema, serialNumberSchema } from '@/lib/validation';
import { CONSENT_POLICY_VERSION, CONSENT_TEXT, FUNDING_DOCUMENT_TYPES } from '@/lib/constants';
import type { DocumentType } from '@prisma/client';

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function clientIp(): string | null {
  const h = headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}

export async function createApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('DEALER_USER');
  if (!session.dealerId) return { error: 'Your account is not linked to a dealer.' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { error: 'Please correct the highlighted fields.', fieldErrors };
  }
  const d = parsed.data;

  // If a Home Depot store was chosen, verify it belongs to this dealer.
  let homeDepotStoreId: string | null = null;
  if (d.homeDepotStoreId) {
    const store = await prisma.homeDepotStore.findFirst({
      where: { id: d.homeDepotStoreId, dealerId: session.dealerId },
    });
    homeDepotStoreId = store?.id ?? null;
  }

  const financeItNumber = d.financeItNumber ? d.financeItNumber.replace(/\s/g, '') : null;
  // A FinanceIt approval number means the deal is already approved.
  const initialStatus = financeItNumber ? 'APPROVED' : 'SUBMITTED';

  // Only persist the extended loan-application record for typed entry.
  const loanApplicationData =
    d.entryMethod === 'TYPED'
      ? {
          create: {
            middleName: d.middleName || null,
            homePhone: d.homePhone || null,
            maritalStatus: d.maritalStatus || null,
            housingStatus: d.housingStatus ?? null,
            monthlyHousingCost: d.monthlyHousingCost ?? null,
            yearsAtAddress: d.yearsAtAddress ?? null,
            city: d.city || null,
            addressProvince: d.addressProvince || null,
            postalCode: d.postalCode || null,
            mailingAddress: d.mailingAddress || null,
            mailingCity: d.mailingCity || null,
            mailingProvince: d.mailingProvince || null,
            mailingPostal: d.mailingPostal || null,
            previousAddress: d.previousAddress || null,
            previousCity: d.previousCity || null,
            previousProvince: d.previousProvince || null,
            previousPostal: d.previousPostal || null,
            worksiteAddress: d.worksiteAddress || null,
            worksiteCity: d.worksiteCity || null,
            worksiteProvince: d.worksiteProvince || null,
            worksitePostal: d.worksitePostal || null,
            idType: d.idType || null,
            idProvince: d.idProvince || null,
            idExpiry: d.idExpiry ? new Date(d.idExpiry) : null,
            businessName: d.businessName || null,
            positionTitle: d.positionTitle || null,
            employerAddress: d.employerAddress || null,
            employerPhone: d.employerPhone || null,
            grossMonthlyIncome: d.grossMonthlyIncome ?? null,
            timeAtJobYears: d.timeAtJobYears ?? null,
            employmentStatus: d.employmentStatus ?? null,
          },
        }
      : undefined;

  const app = await prisma.application.create({
    data: {
      dealerId: session.dealerId,
      createdById: session.userId,
      status: initialStatus,
      entryMethod: d.entryMethod,
      province: d.province,
      programType: d.programType,
      programCategory: d.programCategory,
      requestedAmount: d.requestedAmount,
      dateOfSale: d.dateOfSale ? new Date(d.dateOfSale) : null,
      installationDate: d.installationDate ? new Date(d.installationDate) : null,
      homeDepotStoreId,
      financingNote: d.financingNote || null,
      loanReference: d.loanReference || null,
      financeReference: d.financeReference || null,
      hdReference: d.hdReference || null,
      financeItNumber,
      loanApplication: loanApplicationData,
      applicantFirstName: d.applicantFirstName,
      applicantLastName: d.applicantLastName,
      applicantEmail: d.applicantEmail,
      applicantPhone: d.applicantPhone,
      applicantSinEnc: encryptOptional(d.applicantSin),
      applicantDobEnc: encryptOptional(d.applicantDob),
      applicantAddressEnc: encryptOptional(d.applicantAddress),
      bankAccountEnc: encryptOptional(d.bankAccount),
      govIdNumberEnc: encryptOptional(d.govIdNumber),
      coApplicantName: d.coApplicantName || null,
      coApplicantSinEnc: encryptOptional(d.coApplicantSin),
      incomeAnnual:
        d.incomeAnnual ??
        (d.grossMonthlyIncome ? Math.round(d.grossMonthlyIncome * 12) : null),
      employer: d.employer || d.businessName || null,
      notes: d.notes || null,
      homeownershipRequired: d.homeownershipRequired ?? false,
      consents: {
        create: {
          policyVersion: CONSENT_POLICY_VERSION,
          consentText: CONSENT_TEXT,
          ipAddress: clientIp(),
        },
      },
      statusEvents: {
        create: {
          to: initialStatus,
          actorId: session.userId,
          note: financeItNumber
            ? `Submitted — approved via FinanceIt #${financeItNumber}`
            : 'Application submitted',
        },
      },
    },
  });

  await audit({ actorId: session.userId, action: 'APPLICATION_CREATE', entityType: 'Application', entityId: app.id });
  await audit({ actorId: session.userId, action: 'APPLICATION_SUBMIT', entityType: 'Application', entityId: app.id });

  redirect(`/dealer/applications/${app.id}`);
}

// Store one or more uploaded files (multi-file upload) for an application.
async function storeFiles(
  app: { id: string; dealerId: string; applicantFirstName: string; applicantLastName: string; dateOfSale: Date | null },
  files: File[],
  type: DocumentType,
  stage: 'APPLICATION' | 'FUNDING',
  uploadedById: string,
): Promise<ActionState> {
  const real = files.filter((f) => f && typeof f !== 'string' && f.size > 0);
  if (real.length === 0) return { error: 'No file provided.' };

  let stored = 0;
  for (const file of real) {
    const result = await storeUploadedFile({
      application: app,
      file,
      type,
      stage,
      uploadedById,
    });
    if (!result.ok) {
      return { error: stored > 0 ? `${result.error} (${stored} uploaded before this)` : result.error };
    }
    stored += 1;
  }
  return {};
}

export async function uploadSupportingDocAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('DEALER_USER');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessApplication(session, app.dealerId)) return { error: 'Not found.' };

  const files = formData.getAll('file') as File[];
  const result = await storeFiles(app, files, 'SUPPORTING', 'APPLICATION', session.userId);
  if (result.error) return result;

  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

export async function addSerialNumberAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('DEALER_USER');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessApplication(session, app.dealerId)) return { error: 'Not found.' };

  const parsed = serialNumberSchema.safeParse({
    value: formData.get('value'),
    productLabel: formData.get('productLabel') || undefined,
  });
  if (!parsed.success) return { error: 'Enter a valid serial number.' };

  await prisma.serialNumber.create({
    data: { applicationId, value: parsed.data.value, productLabel: parsed.data.productLabel || null },
  });
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

export async function uploadFundingDocAction(
  applicationId: string,
  docType: DocumentType,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('DEALER_USER');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessApplication(session, app.dealerId)) return { error: 'Not found.' };
  if (!['APPROVED', 'CONDITIONAL', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(app.status)) {
    return { error: 'Funding documents can only be uploaded after approval.' };
  }

  const files = formData.getAll('file') as File[];
  const result = await storeFiles(app, files, docType, 'FUNDING', session.userId);
  if (result.error) return result;

  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

/** Dealer signals the funding package is complete → moves to FUNDING_SUBMITTED. */
export async function submitFundingAction(applicationId: string): Promise<void> {
  const session = await requireRole('DEALER_USER');
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { documents: true },
  });
  if (!app || !canAccessApplication(session, app.dealerId)) redirect('/dealer');
  if (!['APPROVED', 'CONDITIONAL'].includes(app.status)) {
    redirect(`/dealer/applications/${applicationId}`);
  }

  // Verify all required funding documents are present.
  const uploadedTypes = new Set(app.documents.filter((x) => x.stage === 'FUNDING').map((x) => x.type));
  const missing = FUNDING_DOCUMENT_TYPES.filter(
    (t) => t.required && (!t.homeownershipOnly || app.homeownershipRequired) && !uploadedTypes.has(t.type),
  );
  if (missing.length > 0) {
    redirect(`/dealer/applications/${applicationId}?missing=${missing.length}`);
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: 'FUNDING_SUBMITTED' } }),
    prisma.statusEvent.create({
      data: {
        applicationId,
        from: app.status,
        to: 'FUNDING_SUBMITTED',
        actorId: session.userId,
        note: 'Funding package submitted',
      },
    }),
  ]);
  await audit({ actorId: session.userId, action: 'FUNDING_SUBMIT', entityType: 'Application', entityId: applicationId });
  redirect(`/dealer/applications/${applicationId}`);
}

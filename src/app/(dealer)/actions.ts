'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';
import { canAccessAsDealer } from '@/lib/rbac';
import { encryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { storeFiles } from '@/lib/upload';
import { markDealerAction } from '@/lib/activity';
import { notifyNewDocuments, notifyNewNote, notifyNewSubmission, notifyFundingSubmitted } from '@/lib/notify';
import { applicationSchema, serialNumberSchema } from '@/lib/validation';
import { CONSENT_POLICY_VERSION, CONSENT_TEXT } from '@/lib/constants';
import type { DocumentType } from '@prisma/client';

export interface ActionState {
  error?: string;
  ok?: boolean;
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
  const session = await requireDealerAccess();
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
  // Products are a multi-select, so they arrive as repeated form fields.
  const productsSold = formData.getAll('productsSold').map(String).map((s) => s.trim()).filter(Boolean).slice(0, 50);

  // Sales details are required at intake so the journal is complete.
  const salesErrors: Record<string, string> = {};
  if (!d.salespersonName) salesErrors.salespersonName = 'required';
  if (!d.installerName) salesErrors.installerName = 'required';
  if (!d.soapIncluded) salesErrors.soapIncluded = 'required';
  if (productsSold.length === 0 && (await prisma.product.count({ where: { active: true } })) > 0) {
    salesErrors.productsSold = 'required';
  }
  if (Object.keys(salesErrors).length > 0) {
    return { error: 'Please complete the sales details.', fieldErrors: salesErrors };
  }

  // If a Home Depot store was chosen, verify it belongs to this dealer.
  let homeDepotStoreId: string | null = null;
  if (d.homeDepotStoreId) {
    const store = await prisma.homeDepotStore.findFirst({
      where: { id: d.homeDepotStoreId, dealerId: session.dealerId },
    });
    homeDepotStoreId = store?.id ?? null;
  }

  const financeItNumber = d.financeItNumber ? d.financeItNumber.replace(/\s/g, '') : null;
  // A FinanceIT approval number means the deal is already approved.
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
            // Co-applicant (only meaningful when a name was entered). Sensitive
            // fields are encrypted, mirroring the main applicant.
            coFirstName: d.coFirstName || null,
            coLastName: d.coLastName || null,
            coMiddleName: d.coMiddleName || null,
            coDobEnc: encryptOptional(d.coDob),
            coEmail: d.coEmail || null,
            coPhone: d.coPhone || null,
            coHomePhone: d.coHomePhone || null,
            coMaritalStatus: d.coMaritalStatus || null,
            coRelationship: d.coRelationship || null,
            coAddressEnc: encryptOptional(d.coAddress),
            coCity: d.coCity || null,
            coProvince: d.coProvince || null,
            coPostal: d.coPostal || null,
            coIdType: d.coIdType || null,
            coGovIdNumberEnc: encryptOptional(d.coGovIdNumber),
            coIdProvince: d.coIdProvince || null,
            coIdExpiry: d.coIdExpiry ? new Date(d.coIdExpiry) : null,
            coBusinessName: d.coBusinessName || null,
            coPositionTitle: d.coPositionTitle || null,
            coEmployerAddress: d.coEmployerAddress || null,
            coEmployerPhone: d.coEmployerPhone || null,
            coGrossMonthlyIncome: d.coGrossMonthlyIncome ?? null,
            coTimeAtJobYears: d.coTimeAtJobYears ?? null,
            coEmploymentStatus: d.coEmploymentStatus ?? null,
          },
        }
      : undefined;

  // Keep the plaintext co-applicant name on the Application for search/back-compat.
  const coApplicantName =
    [d.coFirstName, d.coLastName].filter(Boolean).join(' ').trim() || d.coApplicantName || null;

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
      salespersonName: d.salespersonName || null,
      installerName: d.installerName || null,
      soapIncluded: d.soapIncluded === 'YES' ? true : d.soapIncluded === 'NO' ? false : null,
      productsSold,
      loanReference: d.loanReference || null,
      financeReference: d.financeReference || null,
      hdReference: d.hdReference || null,
      financeItNumber,
      loanApplication: loanApplicationData,
      applicantFirstName: d.applicantFirstName,
      applicantLastName: d.applicantLastName,
      applicantEmail: d.applicantEmail,
      applicantPhone: d.applicantPhone,
      // SIN and banking are intentionally NOT collected/stored in the portal.
      applicantDobEnc: encryptOptional(d.applicantDob),
      applicantAddressEnc: encryptOptional(d.applicantAddress),
      govIdNumberEnc: encryptOptional(d.govIdNumber),
      coApplicantName,
      incomeAnnual:
        d.incomeAnnual ??
        (d.grossMonthlyIncome ? Math.round(d.grossMonthlyIncome * 12) : null),
      employer: d.employer || d.businessName || null,
      notes: d.notes || null,
      homeownershipRequired: d.homeownershipRequired ?? false,
      lastDealerActionAt: new Date(),
      lastDealerActionKind: 'SUBMITTED',
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
            ? `Submitted — approved, financing deal #${financeItNumber}`
            : 'Application submitted',
        },
      },
    },
  });

  await audit({ actorId: session.userId, action: 'APPLICATION_CREATE', entityType: 'Application', entityId: app.id });
  await audit({ actorId: session.userId, action: 'APPLICATION_SUBMIT', entityType: 'Application', entityId: app.id });
  await notifyNewSubmission(app.id);

  redirect(`/dealer/applications/${app.id}`);
}

export async function uploadSupportingDocAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) return { error: 'Not found.' };

  const files = formData.getAll('file') as File[];
  const result = await storeFiles({ application: app, files, type: 'SUPPORTING', stage: 'APPLICATION', uploadedById: session.userId });
  if (result.error) return result;

  await markDealerAction(applicationId, 'DOCUMENT');
  await notifyNewDocuments(applicationId);
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

export async function addSerialNumberAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) return { error: 'Not found.' };

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
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) return { error: 'Not found.' };
  if (!['APPROVED', 'CONDITIONAL', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(app.status)) {
    return { error: 'Funding documents can only be uploaded after approval.' };
  }

  const files = formData.getAll('file') as File[];
  const result = await storeFiles({ application: app, files, type: docType, stage: 'FUNDING', uploadedById: session.userId });
  if (result.error) return result;

  await markDealerAction(applicationId, 'DOCUMENT');
  await notifyNewDocuments(applicationId);
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

/** Dealer signals the funding package is complete → moves to FUNDING_SUBMITTED. */
/**
 * Save a serial number for each selected product (used when the deal's finance
 * company requires a serial per product, e.g. UEI). Reads serial_<index> fields
 * that line up with the deal's productsSold order.
 */
export async function setProductSerialsAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) return { error: 'Not found.' };

  const products = app.productsSold;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < products.length; i += 1) {
      const value = String(formData.get(`serial_${i}`) || '').trim().slice(0, 120);
      // Replace this product's serial with the submitted value (blank clears it).
      await tx.serialNumber.deleteMany({ where: { applicationId, productLabel: products[i] } });
      if (value) await tx.serialNumber.create({ data: { applicationId, value, productLabel: products[i] } });
    }
  });
  revalidatePath(`/dealer/applications/${applicationId}`);
  return { ok: true };
}

// True when every selected product has a non-empty serial number recorded.
async function productSerialsComplete(applicationId: string): Promise<boolean> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { financeCompany: true, serialNumbers: true },
  });
  if (!app?.financeCompany?.requiresSerialPerProduct) return true;
  const have = new Set(app.serialNumbers.filter((s) => s.value.trim()).map((s) => s.productLabel));
  return app.productsSold.every((p) => have.has(p));
}

export async function submitFundingAction(applicationId: string): Promise<void> {
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) redirect('/dealer');
  if (!['APPROVED', 'CONDITIONAL'].includes(app.status)) {
    redirect(`/dealer/applications/${applicationId}`);
  }
  // Enforce the serial-per-product rule before funding can be submitted.
  if (!(await productSerialsComplete(applicationId))) {
    redirect(`/dealer/applications/${applicationId}`);
  }

  // Funding can be submitted as documents come in — not all are required upfront.
  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: 'FUNDING_SUBMITTED', lastDealerActionAt: new Date(), lastDealerActionKind: 'FUNDING' },
    }),
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
  await notifyFundingSubmitted(applicationId);
  redirect(`/dealer/applications/${applicationId}`);
}

// Dealer acknowledges a must-read pop-up (pressed X / "I've read this"). Records
// the acknowledgement so it won't show again for them. Idempotent.
export async function acknowledgeAlertAction(alertId: string): Promise<void> {
  const session = await requireDealerAccess();
  await prisma.alertAck
    .upsert({
      where: { alertId_userId: { alertId, userId: session.userId } },
      create: { alertId, userId: session.userId },
      update: {},
    })
    .catch(() => {});
  revalidatePath('/dealer');
}

// Dealer adds a note to the dealer-visible thread on their own deal.
export async function addDealerNoteAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) return { error: 'Not found.' };

  const body = String(formData.get('body') || '').trim();
  if (!body) return { error: 'Write a note first.' };

  await prisma.note.create({
    data: { applicationId, authorId: session.userId, body: body.slice(0, 4000), internal: false },
  });
  await markDealerAction(applicationId, 'NOTE');
  await notifyNewNote(applicationId, 'DEALER_USER');
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

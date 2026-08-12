'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';
import { canAccessAsDealer } from '@/lib/rbac';
import { encryptOptional } from '@/lib/crypto';
import { toTitleCase, titleOrNull } from '@/lib/textcase';
import { audit } from '@/lib/audit';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { storeFiles } from '@/lib/upload';
import { deleteDocument } from '@/lib/storage';
import { markDealerAction } from '@/lib/activity';
import { notifyNewDocuments, notifyNewNote, notifyNewSubmission, notifyFundingSubmitted, notifyAdminsUserRequest } from '@/lib/notify';
import { applicationSchema, serialNumberSchema } from '@/lib/validation';
import { mergeProductsSold } from '@/lib/products';
import { parseDealerProfileForm } from '@/lib/dealerProfile';
import { applyDealerLogo } from '@/lib/dealerLogo';
import { CONSENT_POLICY_VERSION, CONSENT_TEXT, PAYMENT_METHOD_LABELS, FUNDING_DOCUMENT_TYPES, SPLIT_PAYMENT_METHODS } from '@/lib/constants';
import { validateSplits } from '@/lib/payments';
import type { DocumentType, PaymentMethod } from '@prisma/client';

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
  // Products are a multi-select (repeated fields) plus a free-text "Other" entry.
  const productsSold = mergeProductsSold(
    formData.getAll('productsSold').map(String),
    formData.get('productsSoldOther') as string | null,
  );

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
  // Express (payment-arranged) deals — and any deal carrying a FinanceIT approval
  // number — come in already approved. Everything else starts as Submitted.
  const paymentMethod = d.entryMethod === 'FINANCEIT' ? (d.paymentMethod ?? null) : null;
  const initialStatus = d.entryMethod === 'FINANCEIT' || financeItNumber ? 'APPROVED' : 'SUBMITTED';

  // Split / multi-method payment (optional). The client posts parallel
  // splitMethod / splitAmount arrays that line up by index.
  const isSplit = String(formData.get('isSplitPayment') || '') === 'on';
  let splitLines: { method: PaymentMethod; amount: number }[] = [];
  let financedAmount: number | null = null;
  if (isSplit) {
    const methods = formData.getAll('splitMethod').map(String);
    const amounts = formData.getAll('splitAmount').map((v) => Number(v));
    const allowed = new Set(SPLIT_PAYMENT_METHODS.map((m) => m.value as string));
    splitLines = methods
      .map((m, i) => ({ method: m as PaymentMethod, amount: amounts[i] }))
      .filter((l) => allowed.has(l.method) && Number(l.amount) > 0);
    const v = validateSplits(splitLines, d.requestedAmount);
    if (!v.ok) return { error: v.error ?? 'Check the split-payment amounts.', fieldErrors: { isSplitPayment: v.error ?? '' } };
    financedAmount = v.financed;
  }

  // Only persist the extended loan-application record for typed entry.
  const loanApplicationData =
    d.entryMethod === 'TYPED'
      ? {
          create: {
            middleName: d.middleName || null,
            homePhone: d.homePhone || null,
            maritalStatus: d.maritalStatus || null,
            housingStatus: d.housingStatus ?? null,
            monthlyHousingCostEnc: encryptOptional(d.monthlyHousingCost != null ? String(d.monthlyHousingCost) : null),
            yearsAtAddress: d.yearsAtAddress ?? null,
            city: d.city || null,
            addressProvince: d.addressProvince || null,
            postalCode: d.postalCode || null,
            mailingAddressEnc: encryptOptional(d.mailingAddress),
            mailingCity: d.mailingCity || null,
            mailingProvince: d.mailingProvince || null,
            mailingPostal: d.mailingPostal || null,
            previousAddressEnc: encryptOptional(d.previousAddress),
            previousCity: d.previousCity || null,
            previousProvince: d.previousProvince || null,
            previousPostal: d.previousPostal || null,
            worksiteAddressEnc: encryptOptional(d.worksiteAddress),
            worksiteCity: d.worksiteCity || null,
            worksiteProvince: d.worksiteProvince || null,
            worksitePostal: d.worksitePostal || null,
            idType: d.idType || null,
            idProvince: d.idProvince || null,
            idExpiry: d.idExpiry ? new Date(d.idExpiry) : null,
            businessName: d.businessName || null,
            positionTitle: d.positionTitle || null,
            employerAddressEnc: encryptOptional(d.employerAddress),
            employerPhone: d.employerPhone || null,
            grossMonthlyIncomeEnc: encryptOptional(d.grossMonthlyIncome != null ? String(d.grossMonthlyIncome) : null),
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
            coEmployerAddressEnc: encryptOptional(d.coEmployerAddress),
            coEmployerPhone: d.coEmployerPhone || null,
            coGrossMonthlyIncomeEnc: encryptOptional(d.coGrossMonthlyIncome != null ? String(d.coGrossMonthlyIncome) : null),
            coTimeAtJobYears: d.coTimeAtJobYears ?? null,
            coEmploymentStatus: d.coEmploymentStatus ?? null,
          },
        }
      : undefined;

  // Keep the plaintext co-applicant name on the Application for search/back-compat.
  const coApplicantName = titleOrNull(
    [d.coFirstName, d.coLastName].filter(Boolean).join(' ').trim() || d.coApplicantName || null,
  );

  const app = await prisma.application.create({
    data: {
      dealerId: session.dealerId,
      createdById: session.userId,
      status: initialStatus,
      entryMethod: d.entryMethod,
      // A split deal's single paymentMethod is ambiguous — the lines are the truth.
      paymentMethod: isSplit ? null : paymentMethod,
      isSplitPayment: isSplit,
      financedAmount,
      paymentSplits: isSplit
        ? { create: splitLines.map((l, i) => ({ method: l.method, amount: l.amount, sortOrder: i })) }
        : undefined,
      province: d.province,
      programType: d.programType,
      programCategory: d.programCategory,
      requestedAmount: d.requestedAmount,
      dateOfSale: d.dateOfSale ? new Date(d.dateOfSale) : null,
      installationDate: d.installationDate ? new Date(d.installationDate) : null,
      homeDepotStoreId,
      financingNote: d.financingNote || null,
      salespersonName: titleOrNull(d.salespersonName),
      installerName: titleOrNull(d.installerName),
      soapIncluded: d.soapIncluded === 'YES' ? true : d.soapIncluded === 'NO' ? false : null,
      productsSold,
      loanReference: d.loanReference || null,
      financeReference: d.financeReference || null,
      hdReference: d.hdReference || null,
      financeItNumber,
      taxExempt: d.taxExempt,
      deliveredToReserve: d.taxExempt ? d.deliveredToReserve : false,
      statusCardNumberEnc: d.taxExempt ? encryptOptional(d.statusCardNumber || null) : null,
      bandName: d.taxExempt ? (d.bandName || null) : null,
      loanApplication: loanApplicationData,
      applicantFirstName: toTitleCase(d.applicantFirstName),
      applicantLastName: toTitleCase(d.applicantLastName),
      applicantEmail: d.applicantEmail,
      applicantPhone: d.applicantPhone,
      // SIN and banking are intentionally NOT collected/stored in the portal.
      applicantDobEnc: encryptOptional(d.applicantDob),
      applicantAddressEnc: encryptOptional(d.applicantAddress),
      govIdNumberEnc: encryptOptional(d.govIdNumber),
      coApplicantName,
      incomeAnnualEnc: (() => {
        const v = d.incomeAnnual ?? (d.grossMonthlyIncome ? Math.round(d.grossMonthlyIncome * 12) : null);
        return encryptOptional(v != null ? String(v) : null);
      })(),
      employer: titleOrNull(d.employer || d.businessName),
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
            : paymentMethod
              ? `Submitted — approved, paid by ${PAYMENT_METHOD_LABELS[paymentMethod]}`
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

  // The uploader tags what the document is (Bill of Sale / Application info /
  // Other → typed). Stored as the document's label and shown as its title.
  const CATEGORY_LABELS: Record<string, string> = {
    BILL_OF_SALE: 'Bill of Sale',
    APPLICATION_INFO: 'Application info',
  };
  const category = String(formData.get('docCategory') || '');
  let label: string | null = null;
  if (category === 'OTHER') {
    label = toTitleCase(String(formData.get('docCategoryOther') || '').trim());
    if (!label) return { error: 'Enter what the document is.' };
  } else if (CATEGORY_LABELS[category]) {
    label = CATEGORY_LABELS[category];
  } else {
    return { error: 'Choose what the document is.' };
  }

  const files = formData.getAll('file') as File[];
  const result = await storeFiles({ application: app, files, type: 'SUPPORTING', stage: 'APPLICATION', uploadedById: session.userId, label });
  if (result.error) return result;

  await markDealerAction(applicationId, 'DOCUMENT');
  notifyNewDocuments(applicationId, result.storedTypes ?? []);
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
  if (!['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(app.status)) {
    return { error: 'Funding documents can only be uploaded after approval.' };
  }

  const files = formData.getAll('file') as File[];
  const result = await storeFiles({ application: app, files, type: docType, stage: 'FUNDING', uploadedById: session.userId });
  if (result.error) return result;

  await markDealerAction(applicationId, 'DOCUMENT');
  notifyNewDocuments(applicationId, result.storedTypes ?? []);
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

/**
 * Batch upload: one submit carrying many files, each with its own category (and,
 * for OTHER, a typed label). Powers the single "snap & send" uploader. The
 * client appends file/category/customLabel in matching order so the arrays line
 * up by index.
 */
export async function uploadFundingBatchAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canAccessAsDealer(session, app.dealerId)) return { error: 'Not found.' };
  if (!['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(app.status)) {
    return { error: 'Funding documents can only be uploaded after approval.' };
  }

  const files = formData.getAll('file') as File[];
  const categories = formData.getAll('category').map(String);
  const customLabels = formData.getAll('customLabel').map(String);
  if (files.length === 0) return { error: 'Add at least one file.' };
  if (categories.length !== files.length) return { error: 'Tag every file with a category.' };

  const allowed = new Set(FUNDING_DOCUMENT_TYPES.map((t) => t.type as string));
  const storedTypes: DocumentType[] = [];
  for (let i = 0; i < files.length; i++) {
    const category = categories[i];
    if (!allowed.has(category)) return { error: 'Choose a category for every file.' };
    const docType = category as DocumentType;
    let namePrefix: string | undefined;
    if (docType === 'OTHER') {
      const custom = (customLabels[i] ?? '').trim().replace(/[^\w\s-]/g, '').slice(0, 40);
      if (!custom) return { error: 'Name each "Other" document before sending.' };
      namePrefix = custom;
    }
    const result = await storeFiles({
      application: app,
      files: [files[i]],
      type: docType,
      stage: 'FUNDING',
      uploadedById: session.userId,
      namePrefix,
    });
    if (result.error) return result;
    storedTypes.push(...(result.storedTypes ?? []));
  }

  await markDealerAction(applicationId, 'DOCUMENT');
  notifyNewDocuments(applicationId, storedTypes);
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

/**
 * Dealer deletes one of their OWN uploads (a wrong file, to re-upload). Guarded:
 * only their dealer's deal, never GWA's paperwork, and not once GWA has confirmed
 * the file.
 */
export async function deleteOwnDocumentAction(documentId: string): Promise<{ error?: string }> {
  const session = await requireDealerAccess();
  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { application: true } });
  if (!doc || !canAccessAsDealer(session, doc.application.dealerId)) return { error: 'Not found.' };
  if (doc.stage === 'REVIEWER') return { error: 'This document was sent by GWA and can’t be deleted here.' };
  if (doc.verifiedAt) return { error: 'GWA has confirmed this file — contact them to change it.' };

  try {
    await deleteDocument(doc.storageKey);
  } catch (e) {
    console.error('[deleteOwnDocument] storage delete failed', e);
  }
  await prisma.document.delete({ where: { id: documentId } });
  await audit({
    actorId: session.userId,
    action: 'DOCUMENT_DELETE',
    entityType: 'Document',
    entityId: documentId,
    detail: `Dealer deleted ${doc.fileName}`,
  });
  revalidatePath(`/dealer/applications/${doc.applicationId}`);
  revalidatePath(`/staff/applications/${doc.applicationId}`);
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
  if (!['APPROVED', 'CONDITIONAL', 'DOCS_SENT'].includes(app.status)) {
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

  // Hard block: never store payment-card data.
  const card = findCardData(body);
  if (card.blocked) {
    await audit({ actorId: session.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: `Note blocked — card data detected (${card.signals.join(', ')})` });
    return { error: CARD_BLOCK_MESSAGE };
  }

  await prisma.note.create({
    data: { applicationId, authorId: session.userId, body: body.slice(0, 4000), internal: false },
  });
  await markDealerAction(applicationId, 'NOTE');
  await notifyNewNote(applicationId, 'DEALER_USER');
  revalidatePath(`/dealer/applications/${applicationId}`);
  return {};
}

// --- New-user requests -----------------------------------------------------
// A dealer lists the people at their office who need a portal login. The request
// lands in the admin approval queue (Admin → User requests); on approval each
// person becomes a login on this dealer with a temporary password.
interface RequestRowInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  jobTitle?: unknown;
  isMainContact?: unknown;
}

export async function submitUserRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'Your account is not linked to a dealership.' };

  let parsed: { note?: unknown; rows?: unknown };
  try {
    parsed = JSON.parse(String(formData.get('payload') || '{}'));
  } catch {
    return { error: 'Could not read the form. Please try again.' };
  }
  const rawRows = Array.isArray(parsed.rows) ? (parsed.rows as RequestRowInput[]) : [];
  const note = String(parsed.note ?? '').trim().slice(0, 500) || null;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const rows: { name: string; email: string; phone: string | null; jobTitle: string | null; isMainContact: boolean }[] = [];
  const seen = new Set<string>();
  for (const r of rawRows) {
    const name = toTitleCase(String(r.name ?? '').trim());
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!name && !email) continue; // skip blank rows
    if (!name) return { error: 'Every person needs a name.' };
    if (!emailRe.test(email)) return { error: `Enter a valid email for ${name}.` };
    if (seen.has(email)) return { error: `${email} is listed twice.` };
    seen.add(email);
    rows.push({
      name,
      email,
      phone: String(r.phone ?? '').trim().slice(0, 40) || null,
      jobTitle: titleOrNull(String(r.jobTitle ?? '').trim().slice(0, 80)),
      isMainContact: r.isMainContact === true,
    });
  }
  if (rows.length === 0) return { error: 'Add at least one person.' };
  if (rows.length > 25) return { error: 'That’s a lot at once — please submit 25 or fewer people per request.' };

  const request = await prisma.userRequest.create({
    data: {
      dealerId: session.dealerId,
      submittedById: session.userId,
      note,
      items: { create: rows },
    },
  });
  await audit({
    actorId: session.userId,
    action: 'USER_REQUEST',
    entityType: 'UserRequest',
    entityId: request.id,
    detail: `${rows.length} user${rows.length === 1 ? '' : 's'} requested`,
  });
  await notifyAdminsUserRequest(request.id);
  revalidatePath('/dealer/user-requests');
  return { ok: true };
}

// --- Office profile (dealer edits their own) --------------------------------
export async function saveDealerProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'Your account is not linked to a dealership.' };
  const data = parseDealerProfileForm(formData);
  await prisma.dealerProfile.upsert({
    where: { dealerId: session.dealerId },
    create: { dealerId: session.dealerId, updatedById: session.userId, ...data },
    update: { updatedById: session.userId, ...data },
  });
  const logo = await applyDealerLogo(session.dealerId, formData);
  if (logo.error) return { error: logo.error };
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'DealerProfile', entityId: session.dealerId, detail: 'Office profile updated' });
  revalidatePath('/dealer/profile');
  revalidatePath('/staff/directory');
  return { ok: true };
}

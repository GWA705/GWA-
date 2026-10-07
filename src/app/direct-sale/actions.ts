'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { encryptOptional } from '@/lib/crypto';
import { mergeProductsSold } from '@/lib/products';
import { storeFiles } from '@/lib/upload';
import { syncApplicationToJournal } from '@/lib/journalSync';
import { requireDirectSaleAccess } from '@/lib/directSaleAccess';
import { directSaleSchema } from '@/lib/validation';
import {
  dealIsFinanced,
  missingRequiredReferences,
  MAX_FILE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/constants';

export interface DirectSaleState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const mb = Math.floor(MAX_FILE_BYTES / 1024 / 1024);

/**
 * Create a Georgian Water & Air "Direct sale" — a walk-in in-store sale entered
 * by GWA staff — and complete it straight to Funded + Paid in one step:
 *  - requires a bill-of-sale upload and a marked payment source,
 *  - sets status FUNDED and the paid date to the sale date, and
 *  - writes the sales-journal row as settled ("OK" + Date Paid).
 *
 * Access is gated to the GWA team: internal staff implicitly, or a specific user
 * with the canEnterDirectSale grant (see requireDirectSaleAccess). Never a
 * general dealer feature.
 */
export async function createDirectSaleAction(
  _prev: DirectSaleState,
  formData: FormData,
): Promise<DirectSaleState> {
  const session = await requireDirectSaleAccess();
  const internal = session.role === 'REVIEWER' || session.role === 'ADMIN';

  const parsed = directSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: 'Please correct the highlighted fields.', fieldErrors };
  }
  const d = parsed.data;

  // Owning office. Internal staff choose it; a granted GWA-store (DEALER_USER)
  // grantee is locked to their own dealer — never another office's.
  const dealerId = internal ? d.dealerId : session.dealerId ?? '';
  if (!dealerId) return { error: 'No Georgian Water & Air office is set for your account — ask an admin.' };
  const dealer = await prisma.dealer.findFirst({ where: { id: dealerId }, select: { id: true } });
  if (!dealer) return { error: 'Please correct the highlighted fields.', fieldErrors: { dealerId: 'Choose a valid office.' } };

  // A direct sale is a real, paid sale — a bill of sale is required.
  const bill = formData.get('billOfSaleFile');
  if (!bill || typeof bill === 'string' || bill.size === 0) {
    return { error: 'Attach the bill of sale to complete the sale.', fieldErrors: { billOfSaleFile: 'A bill of sale is required.' } };
  }
  if (bill.size > MAX_FILE_BYTES) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: { billOfSaleFile: `File exceeds the ${mb} MB limit.` } };
  }
  if (!ALLOWED_MIME_TYPES.includes(bill.type)) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: { billOfSaleFile: 'Use a PDF or a photo (JPG, PNG, HEIC).' } };
  }

  // At least one product so the journal "UNITS" count is meaningful.
  const productsSold = mergeProductsSold(
    formData.getAll('productsSold').map(String),
    String(formData.get('productsSoldOther') ?? ''),
  );
  if (productsSold.length === 0) {
    return { error: 'Please correct the highlighted fields.', fieldErrors: { productsSold: 'Pick at least one product sold.' } };
  }

  // Payment source gate — the same rule funding uses: a GWA-program cash sale
  // needs no reference numbers; an HD-program sale needs the HD Customer #, and
  // a financed sale needs the financing deal number.
  const financed = dealIsFinanced(d.paymentMethod);
  const missing = missingRequiredReferences({
    hdReference: d.hdReference ?? null,
    financeItNumber: d.financeItNumber ?? null,
    financed,
    programType: d.programType,
  });
  if (missing.length) {
    return { error: `To complete this direct sale, add ${missing.join(' and ')}.` };
  }

  const saleDate = new Date(d.dateOfSale);

  // Guard against a double-submit creating two paid deals + two journal rows:
  // the same office + customer + sale date within a few minutes is a duplicate.
  const dupSince = new Date(Date.now() - 3 * 60 * 1000);
  const dup = await prisma.application.findFirst({
    where: {
      dealerId,
      entryMethod: 'DIRECT',
      applicantFirstName: d.applicantFirstName,
      applicantLastName: d.applicantLastName,
      createdAt: { gte: dupSince },
    },
    select: { id: true },
  });
  if (dup) redirect(internal ? `/staff/applications/${dup.id}` : `/dealer/applications/${dup.id}`);

  const app = await prisma.application.create({
    data: {
      dealerId,
      createdById: session.userId,
      status: 'FUNDED',
      entryMethod: 'DIRECT',
      paymentMethod: d.paymentMethod,
      financeCompanyId: financed ? d.financeCompanyId ?? null : null,
      province: d.province,
      applicantCity: d.city || null,
      applicantPostal: d.postalCode || null,
      programType: d.programType,
      programCategory: d.programCategory,
      requestedAmount: d.requestedAmount,
      // A completed walk-in sale: the approved amount is the amount sold.
      approvedAmount: d.requestedAmount,
      approvedById: session.userId,
      dateOfSale: saleDate,
      installationDate: d.installationDate ? new Date(d.installationDate) : null,
      // Paid, on the sale date — drives the portal's Paid state and the journal
      // "OK" + Date Paid write.
      datePaid: saleDate,
      journalPaidOn: saleDate,
      salespersonName: d.salespersonName ?? null,
      installerName: d.installerName ?? null,
      soapIncluded: d.soapIncluded ? d.soapIncluded !== 'NO' : null,
      soapType: d.soapIncluded || null,
      productsSold,
      hdReference: d.hdReference || null,
      financeItNumber: financed ? d.financeItNumber || null : null,
      applicantFirstName: d.applicantFirstName,
      applicantLastName: d.applicantLastName,
      applicantEmail: d.applicantEmail,
      applicantPhone: d.applicantPhone,
      applicantAddressEnc: encryptOptional(d.applicantAddress),
      lastReviewerActionAt: new Date(),
      statusEvents: {
        create: {
          to: 'FUNDED',
          actorId: session.userId,
          note: 'Direct sale — entered and completed (Funded + Paid)',
        },
      },
    },
  });

  await audit({ actorId: session.userId, action: 'APPLICATION_CREATE', entityType: 'Application', entityId: app.id, detail: 'Direct sale' });
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'Application', entityId: app.id, detail: 'Direct sale — marked Funded + Paid' });

  // Store the bill of sale. The deal is already created + funded, so a storage
  // failure here must not undo the sale — log it; it can be re-uploaded on the
  // deal page.
  const stored = await storeFiles({
    application: { id: app.id, dealerId, applicantFirstName: app.applicantFirstName, applicantLastName: app.applicantLastName, dateOfSale: saleDate },
    files: [bill],
    type: 'SUPPORTING',
    stage: 'APPLICATION',
    uploadedById: session.userId,
    label: 'Bill of Sale',
  });
  if (stored.error) console.error('[directSale] bill-of-sale store failed', stored.error);

  // Write the settled row to the sales journal (best-effort — OK + Date Paid).
  await syncApplicationToJournal(app.id, session.userId);

  redirect(internal ? `/staff/applications/${app.id}` : `/dealer/applications/${app.id}`);
}

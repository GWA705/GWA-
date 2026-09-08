import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { isSuperAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { readEnc } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { STATUS_LABELS, PAYMENT_METHOD_LABELS, programLabel } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * FULL customer-data export (CSV) — Super Admin only. One row per application
 * with every stored field, INCLUDING the sensitive fields decrypted (SIN, DOB,
 * street address, bank, government ID, income, co-applicant). This concentrates
 * a lot of PII into one file, so it is Super-Admin-gated and audited (DATA_EXPORT)
 * with the record count. Never cache the response.
 */

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dec = (enc: string | null | undefined, legacy?: unknown): string => readEnc(enc, legacy) ?? '';
const day = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : '');
const num = (n: unknown): string => (n == null ? '' : String(n));

export async function GET() {
  const user = await requireRole('ADMIN');
  if (!isSuperAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const apps = await prisma.application.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: {
      loanApplication: true,
      homeDepotStore: { select: { number: true, name: true } },
      dealer: { select: { name: true } },
    },
  });

  // Column definitions — header + a getter, so headers and values never drift.
  type App = (typeof apps)[number];
  const cols: { h: string; get: (a: App) => string }[] = [
    { h: 'application_id', get: (a) => a.id },
    { h: 'created_at', get: (a) => a.createdAt.toISOString() },
    { h: 'status', get: (a) => STATUS_LABELS[a.status] ?? a.status },
    { h: 'office', get: (a) => a.dealer?.name ?? '' },
    { h: 'hd_store', get: (a) => (a.homeDepotStore ? `${a.homeDepotStore.number}${a.homeDepotStore.name ? ` — ${a.homeDepotStore.name}` : ''}` : '') },
    { h: 'date_of_sale', get: (a) => day(a.dateOfSale) },
    { h: 'installation_date', get: (a) => day(a.installationDate) },
    { h: 'date_paid', get: (a) => day(a.datePaid) },
    { h: 'program', get: (a) => programLabel(a.programType, a.programCategory) },
    { h: 'requested_amount', get: (a) => num(a.requestedAmount) },
    { h: 'approved_amount', get: (a) => num(a.approvedAmount) },
    { h: 'financed_amount', get: (a) => num(a.financedAmount) },
    { h: 'payment_method', get: (a) => (a.paymentMethod ? PAYMENT_METHOD_LABELS[a.paymentMethod] ?? '' : '') },
    { h: 'financeit_number', get: (a) => a.financeItNumber ?? '' },
    { h: 'hd_reference', get: (a) => a.hdReference ?? '' },
    { h: 'products_sold', get: (a) => (a.productsSold ?? []).filter(Boolean).join(' | ') },
    { h: 'salesperson', get: (a) => a.salespersonName ?? '' },
    { h: 'installer', get: (a) => a.installerName ?? '' },
    { h: 'lead_generator', get: (a) => a.leadGenerator ?? '' },

    // Applicant identity + contact
    { h: 'applicant_first_name', get: (a) => a.applicantFirstName },
    { h: 'applicant_middle_name', get: (a) => a.loanApplication?.middleName ?? '' },
    { h: 'applicant_last_name', get: (a) => a.applicantLastName },
    { h: 'applicant_email', get: (a) => a.applicantEmail },
    { h: 'applicant_phone', get: (a) => a.applicantPhone },
    { h: 'applicant_home_phone', get: (a) => a.loanApplication?.homePhone ?? '' },
    { h: 'applicant_marital_status', get: (a) => a.loanApplication?.maritalStatus ?? '' },
    { h: 'applicant_dob', get: (a) => dec(a.applicantDobEnc) },
    { h: 'applicant_sin', get: (a) => dec(a.applicantSinEnc) },
    { h: 'applicant_address', get: (a) => dec(a.applicantAddressEnc) },
    { h: 'applicant_city', get: (a) => a.applicantCity ?? '' },
    { h: 'applicant_province', get: (a) => a.province ?? '' },
    { h: 'applicant_postal', get: (a) => a.applicantPostal ?? '' },

    // Borrower ID
    { h: 'id_type', get: (a) => a.loanApplication?.idType ?? '' },
    { h: 'id_number', get: (a) => dec(a.govIdNumberEnc) },
    { h: 'id_province', get: (a) => a.loanApplication?.idProvince ?? '' },
    { h: 'id_expiry', get: (a) => day(a.loanApplication?.idExpiry) },

    // Housing
    { h: 'housing_status', get: (a) => a.loanApplication?.housingStatus ?? '' },
    { h: 'monthly_housing_cost', get: (a) => dec(a.loanApplication?.monthlyHousingCostEnc, a.loanApplication?.monthlyHousingCost) },
    { h: 'years_at_address', get: (a) => num(a.loanApplication?.yearsAtAddress) },

    // Employment & income
    { h: 'employer_business_name', get: (a) => a.loanApplication?.businessName ?? '' },
    { h: 'position_title', get: (a) => a.loanApplication?.positionTitle ?? '' },
    { h: 'employer_address', get: (a) => dec(a.loanApplication?.employerAddressEnc, a.loanApplication?.employerAddress) },
    { h: 'employer_phone', get: (a) => a.loanApplication?.employerPhone ?? '' },
    { h: 'gross_monthly_income', get: (a) => dec(a.loanApplication?.grossMonthlyIncomeEnc, a.loanApplication?.grossMonthlyIncome) },
    { h: 'time_at_job_years', get: (a) => num(a.loanApplication?.timeAtJobYears) },
    { h: 'employment_status', get: (a) => a.loanApplication?.employmentStatus ?? '' },
    { h: 'income_annual', get: (a) => dec(a.incomeAnnualEnc, a.incomeAnnual) },

    // Banking
    { h: 'bank_account', get: (a) => dec(a.bankAccountEnc) },

    // Secondary addresses
    { h: 'mailing_address', get: (a) => dec(a.loanApplication?.mailingAddressEnc, a.loanApplication?.mailingAddress) },
    { h: 'mailing_city', get: (a) => a.loanApplication?.mailingCity ?? '' },
    { h: 'mailing_province', get: (a) => a.loanApplication?.mailingProvince ?? '' },
    { h: 'mailing_postal', get: (a) => a.loanApplication?.mailingPostal ?? '' },
    { h: 'previous_address', get: (a) => dec(a.loanApplication?.previousAddressEnc, a.loanApplication?.previousAddress) },
    { h: 'worksite_address', get: (a) => dec(a.loanApplication?.worksiteAddressEnc, a.loanApplication?.worksiteAddress) },

    // First Nations tax exemption
    { h: 'tax_exempt', get: (a) => (a.taxExempt ? 'yes' : '') },
    { h: 'delivered_to_reserve', get: (a) => (a.deliveredToReserve ? 'yes' : '') },
    { h: 'status_card_number', get: (a) => dec(a.statusCardNumberEnc) },
    { h: 'band_name', get: (a) => a.bandName ?? '' },

    // Co-applicant
    { h: 'co_first_name', get: (a) => a.loanApplication?.coFirstName ?? '' },
    { h: 'co_middle_name', get: (a) => a.loanApplication?.coMiddleName ?? '' },
    { h: 'co_last_name', get: (a) => a.loanApplication?.coLastName ?? '' },
    { h: 'co_relationship', get: (a) => a.loanApplication?.coRelationship ?? '' },
    { h: 'co_dob', get: (a) => dec(a.loanApplication?.coDobEnc) },
    { h: 'co_sin', get: (a) => dec(a.coApplicantSinEnc) },
    { h: 'co_email', get: (a) => a.loanApplication?.coEmail ?? '' },
    { h: 'co_phone', get: (a) => a.loanApplication?.coPhone ?? '' },
    { h: 'co_marital_status', get: (a) => a.loanApplication?.coMaritalStatus ?? '' },
    { h: 'co_address', get: (a) => dec(a.loanApplication?.coAddressEnc) },
    { h: 'co_city', get: (a) => a.loanApplication?.coCity ?? '' },
    { h: 'co_province', get: (a) => a.loanApplication?.coProvince ?? '' },
    { h: 'co_postal', get: (a) => a.loanApplication?.coPostal ?? '' },
    { h: 'co_id_type', get: (a) => a.loanApplication?.coIdType ?? '' },
    { h: 'co_id_number', get: (a) => dec(a.loanApplication?.coGovIdNumberEnc) },
    { h: 'co_id_province', get: (a) => a.loanApplication?.coIdProvince ?? '' },
    { h: 'co_id_expiry', get: (a) => day(a.loanApplication?.coIdExpiry) },
    { h: 'co_employer_business_name', get: (a) => a.loanApplication?.coBusinessName ?? '' },
    { h: 'co_position_title', get: (a) => a.loanApplication?.coPositionTitle ?? '' },
    { h: 'co_employer_address', get: (a) => dec(a.loanApplication?.coEmployerAddressEnc, a.loanApplication?.coEmployerAddress) },
    { h: 'co_employer_phone', get: (a) => a.loanApplication?.coEmployerPhone ?? '' },
    { h: 'co_gross_monthly_income', get: (a) => dec(a.loanApplication?.coGrossMonthlyIncomeEnc, a.loanApplication?.coGrossMonthlyIncome) },
    { h: 'co_time_at_job_years', get: (a) => num(a.loanApplication?.coTimeAtJobYears) },
    { h: 'co_employment_status', get: (a) => a.loanApplication?.coEmploymentStatus ?? '' },

    { h: 'notes', get: (a) => a.notes ?? '' },
  ];

  const headerRow = cols.map((c) => c.h);
  const dataRows = apps.map((a) => cols.map((c) => csvCell(c.get(a))));

  await audit({
    actorId: user.userId,
    action: 'DATA_EXPORT',
    entityType: 'Application',
    detail: `Full customer CSV export — ${apps.length} record(s), decrypted PII`,
  });

  // BOM so Excel opens the UTF-8 CSV cleanly.
  const csv = '﻿' + [headerRow.map(csvCell).join(','), ...dataRows.map((r) => r.join(','))].join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gwa-full-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

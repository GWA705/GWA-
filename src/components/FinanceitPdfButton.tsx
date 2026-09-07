'use client';

import { useState } from 'react';
import { FileDown, Loader2, AlertTriangle } from 'lucide-react';
import { fillFinanceitPdf, type BorrowerFields } from '@/lib/financeit/fill';

/**
 * Generate a pre-filled Financeit loan-application PDF from the current form
 * values (primary + optional co-borrower) and download it, so the dealer can
 * upload it to Financeit. Runs entirely in the browser off the values already
 * on screen — nothing is sent to the server.
 */

const val = (id: string) =>
  ((document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '').trim();
const named = (name: string) =>
  ((document.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value ?? '').trim();

function readPrimary(): BorrowerFields {
  return {
    firstName: val('applicantFirstName'),
    middleName: val('middleName'),
    lastName: val('applicantLastName'),
    dob: named('applicantDob'),
    homePhone: val('homePhone'),
    mobilePhone: val('applicantPhone'),
    maritalStatus: val('maritalStatus'),
    email: val('applicantEmail'),
    address: val('applicantAddress'),
    monthlyHousingCost: val('monthlyHousingCost'),
    city: val('city'),
    province: val('province'),
    postal: val('postalCode'),
    yearsAtAddress: val('yearsAtAddress'),
    housingStatus: val('housingStatus'),
    idType: val('idType'),
    idProvince: val('idProvince'),
    idNumber: val('govIdNumber'),
    idExpiry: val('idExpiry'),
    businessName: val('businessName'),
    employerPhone: val('employerPhone'),
    positionTitle: val('positionTitle'),
    grossMonthlyIncome: val('grossMonthlyIncome'),
    employerAddress: val('employerAddress'),
    timeAtJob: val('timeAtJobYears'),
  };
}

function readCo(): BorrowerFields {
  return {
    firstName: val('coFirstName'),
    middleName: val('coMiddleName'),
    lastName: val('coLastName'),
    dob: named('coDob'),
    homePhone: val('coHomePhone'),
    mobilePhone: val('coPhone'),
    maritalStatus: val('coMaritalStatus'),
    email: val('coEmail'),
    address: val('coAddress'),
    city: val('coCity'),
    province: val('coProvince'),
    postal: val('coPostal'),
    idType: val('coIdType'),
    idProvince: val('coIdProvince'),
    idNumber: val('coGovIdNumber'),
    idExpiry: val('coIdExpiry'),
    businessName: val('coBusinessName'),
    employerPhone: val('coEmployerPhone'),
    positionTitle: val('coPositionTitle'),
    grossMonthlyIncome: val('coGrossMonthlyIncome'),
    employerAddress: val('coEmployerAddress'),
    timeAtJob: val('coTimeAtJobYears'),
  };
}

export function FinanceitPdfButton({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');

  async function generate() {
    setStatus('working');
    try {
      const primary = readPrimary();
      if (!primary.firstName && !primary.lastName) {
        setStatus('error');
        return;
      }
      const co = readCo();
      const hasCo = Boolean(co.firstName || co.lastName);

      const res = await fetch('/financeit-loan-application.pdf');
      if (!res.ok) throw new Error('template fetch failed');
      const template = await res.arrayBuffer();

      const bytes = await fillFinanceitPdf(template, primary, hasCo ? co : null);
      const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const last = (primary.lastName || primary.firstName || 'applicant').replace(/[^A-Za-z0-9]+/g, '');
      a.download = `Financeit-${last}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={generate}
        disabled={status === 'working'}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
      >
        {status === 'working' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        {status === 'working' ? 'Building PDF…' : 'Download Financeit PDF'}
      </button>
      {status === 'error' && (
        <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle size={13} /> Enter at least the applicant’s name first, then try again.
        </p>
      )}
    </div>
  );
}

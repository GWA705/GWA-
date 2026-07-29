'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveConfirmationAction, type ActionState } from '@/app/(staff)/actions';
import { CONFIRMATION_PHONE } from '@/lib/constants';
import type { Confirmation } from '@prisma/client';

const QUESTIONS: { name: keyof CheckState; label: string; group: 1 | 2 }[] = [
  { name: 'installedWorking', label: 'Is the product installed in your home and working fine?', group: 1 },
  { name: 'performingAsRepresented', label: 'Is the product performing the way the salesperson represented it?', group: 1 },
  { name: 'receivedEverything', label: 'Did you receive everything that you were promised?', group: 1 },
  { name: 'termsAgreed', label: 'These are the terms you agreed to?', group: 2 },
  { name: 'signatureConfirmed', label: 'This is your signature on the application?', group: 2 },
  { name: 'notTrialOffer', label: 'You are aware that this is not a trial offer?', group: 2 },
];

interface CheckState {
  installedWorking: boolean;
  performingAsRepresented: boolean;
  receivedEverything: boolean;
  termsAgreed: boolean;
  signatureConfirmed: boolean;
  notTrialOffer: boolean;
}

function Buttons({ allChecked }: { allChecked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" name="intent" value="save" className="btn-secondary text-sm" disabled={pending}>
        Save
      </button>
      <button type="submit" name="intent" value="complete" className="btn-primary text-sm" disabled={pending || !allChecked}>
        Confirm complete
      </button>
      <button type="submit" name="intent" value="issue" className="btn-danger text-sm" disabled={pending}>
        Mark issue
      </button>
      {!allChecked && <span className="text-xs text-amber-700">Check all six boxes to complete.</span>}
    </div>
  );
}

export function ConfirmationForm({
  applicationId,
  data,
  applicantName,
  defaultProduct,
  defaultPhone,
  defaultAmount,
}: {
  applicationId: string;
  data: Confirmation | null;
  applicantName: string;
  defaultProduct: string;
  defaultPhone: string;
  defaultAmount: string;
}) {
  const [state, action] = useFormState(saveConfirmationAction, {} as ActionState);
  const [checked, setChecked] = useState<CheckState>({
    installedWorking: data?.installedWorking ?? false,
    performingAsRepresented: data?.performingAsRepresented ?? false,
    receivedEverything: data?.receivedEverything ?? false,
    termsAgreed: data?.termsAgreed ?? false,
    signatureConfirmed: data?.signatureConfirmed ?? false,
    notTrialOffer: data?.notTrialOffer ?? false,
  });
  const allChecked = Object.values(checked).every(Boolean);
  const val = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

  return (
    <form action={action} className="space-y-5 text-sm">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Confirmation saved.</div>}
      <input type="hidden" name="applicationId" value={applicationId} />

      {/* Header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><label className="label">Customer</label><input className="input" value={applicantName} disabled /></div>
        <div><label className="label"># of calls</label><input name="numberOfCalls" type="number" min="0" defaultValue={val(data?.numberOfCalls)} className="input" /></div>
        <div><label className="label">Product</label><input name="productName" defaultValue={data?.productName ?? defaultProduct} className="input" /></div>
        <div><label className="label">City</label><input name="city" defaultValue={val(data?.city)} className="input" /></div>
        <div><label className="label">District</label><input name="district" defaultValue={val(data?.district)} className="input" /></div>
        <div><label className="label">Phone</label><input name="phoneNumber" defaultValue={data?.phoneNumber ?? defaultPhone} className="input" /></div>
      </div>

      <p className="rounded bg-gray-50 p-3 text-xs text-gray-600">
        “Hi, may I speak with {applicantName}. My name is [you] and I'm calling from TDC… go over your
        recent purchase… this call may be recorded… your application was approved. I just have a couple
        of questions for you:”
      </p>

      {/* Questions 1-3 */}
      <fieldset className="space-y-2">
        {QUESTIONS.filter((q) => q.group === 1).map((q) => (
          <label key={q.name} className="flex items-start gap-2">
            <input
              type="checkbox"
              name={q.name}
              value="on"
              checked={checked[q.name]}
              onChange={(e) => setChecked((c) => ({ ...c, [q.name]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>{q.label}</span>
          </label>
        ))}
      </fieldset>

      {/* Terms */}
      <div className="rounded border border-gray-100 p-3">
        <p className="mb-2 text-xs text-gray-600">“Now I need to quickly go over your terms: You are financing…”</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className="label">Financing $</label><input name="financingAmount" type="number" step="0.01" min="0" defaultValue={data?.financingAmount ? String(data.financingAmount) : defaultAmount} className="input" /></div>
          <div><label className="label">Over (months)</label><input name="termMonths" type="number" min="0" defaultValue={val(data?.termMonths)} className="input" /></div>
          <div><label className="label">1st installment $</label><input name="firstInstallmentAmount" type="number" step="0.01" min="0" defaultValue={data?.firstInstallmentAmount ? String(data.firstInstallmentAmount) : ''} className="input" /></div>
          <div><label className="label">1st installment date</label><input name="firstInstallmentDate" type="date" defaultValue={data?.firstInstallmentDate ? new Date(data.firstInstallmentDate).toISOString().slice(0, 10) : ''} className="input" /></div>
        </div>
      </div>

      {/* Questions 4-6 */}
      <fieldset className="space-y-2">
        <p className="text-xs text-gray-600">“Great, I just need to verify that:”</p>
        {QUESTIONS.filter((q) => q.group === 2).map((q) => (
          <label key={q.name} className="flex items-start gap-2">
            <input
              type="checkbox"
              name={q.name}
              value="on"
              checked={checked[q.name]}
              onChange={(e) => setChecked((c) => ({ ...c, [q.name]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>{q.label}</span>
          </label>
        ))}
      </fieldset>

      <p className="text-xs text-gray-500">Closing: customer service line, Woodbridge ON — {CONFIRMATION_PHONE}.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">Special arrangements</label><textarea name="specialArrangements" rows={2} defaultValue={val(data?.specialArrangements)} className="input" /></div>
        <div><label className="label">HD confirmation notes</label><textarea name="hdNotes" rows={2} defaultValue={val(data?.hdNotes)} className="input" /></div>
      </div>
      <div><label className="label">Issue note (if marking an issue)</label><input name="issueNote" defaultValue={val(data?.issueNote)} className="input" /></div>

      <Buttons allChecked={allChecked} />
    </form>
  );
}

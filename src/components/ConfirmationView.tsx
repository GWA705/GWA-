import type { Confirmation } from '@prisma/client';
import { REVIEWER_DISPLAY } from '@/lib/constants';

type WithConfirmer = Confirmation & { confirmedBy?: { name: string } | null };

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        {ok ? '✓' : ''}
      </span>
      <span className={ok ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
    </li>
  );
}

export function ConfirmationView({ c, anonymizeStaff = false }: { c: WithConfirmer; anonymizeStaff?: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1.5">
        <Check ok={c.installedWorking} label="Installed in the home and working fine" />
        <Check ok={c.performingAsRepresented} label="Performing as the salesperson represented" />
        <Check ok={c.receivedEverything} label="Received everything promised" />
        <Check ok={c.termsAgreed} label="Agreed to the terms" />
        <Check ok={c.signatureConfirmed} label="Confirmed signature on the application" />
        <Check ok={c.notTrialOffer} label="Aware this is not a trial offer" />
      </ul>

      {(c.financingAmount || c.termMonths) && (
        <p className="text-gray-600">
          Financing {c.financingAmount ? `$${c.financingAmount.toString()}` : '—'}
          {c.termMonths ? ` over ${c.termMonths} months` : ''}
          {c.firstInstallmentAmount ? `, first installment $${c.firstInstallmentAmount.toString()}` : ''}
          {c.firstInstallmentDate ? ` on ${new Date(c.firstInstallmentDate).toLocaleDateString('en-CA')}` : ''}.
        </p>
      )}

      {c.specialArrangements && (
        <p className="text-gray-600"><span className="font-medium">Special arrangements: </span>{c.specialArrangements}</p>
      )}
      {c.issueNote && (
        <p className="rounded bg-red-50 p-2 text-red-700"><span className="font-medium">Issue: </span>{c.issueNote}</p>
      )}
      {c.completedAt && (
        <p className="text-xs text-gray-400">
          Confirmed by {anonymizeStaff ? REVIEWER_DISPLAY : c.confirmedBy?.name ?? 'GWA'} · {new Date(c.completedAt).toLocaleString('en-CA')}
        </p>
      )}
    </div>
  );
}

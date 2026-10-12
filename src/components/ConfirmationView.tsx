import type { Confirmation } from '@prisma/client';
import { REVIEWER_DISPLAY } from '@/lib/constants';
import { getT } from '@/i18n/server';

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
  const t = getT();
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1.5">
        <Check ok={c.installedWorking} label={t('staffMisc.confirmView.installedWorking')} />
        <Check ok={c.performingAsRepresented} label={t('staffMisc.confirmView.performingAsRepresented')} />
        <Check ok={c.receivedEverything} label={t('staffMisc.confirmView.receivedEverything')} />
        <Check ok={c.termsAgreed} label={t('staffMisc.confirmView.termsAgreed')} />
        <Check ok={c.signatureConfirmed} label={t('staffMisc.confirmView.signatureConfirmed')} />
        <Check ok={c.notTrialOffer} label={t('staffMisc.confirmView.notTrialOffer')} />
      </ul>

      {(c.financingAmount || c.termMonths) && (
        <p className="text-gray-600">
          {t('staffMisc.confirmView.financing')} {c.financingAmount ? `$${c.financingAmount.toString()}` : '—'}
          {c.termMonths ? ` ${t('staffMisc.confirmView.overMonths', { n: c.termMonths })}` : ''}
          {c.firstInstallmentAmount ? `, ${t('staffMisc.confirmView.firstInstallmentOf', { amount: `$${c.firstInstallmentAmount.toString()}` })}` : ''}
          {c.firstInstallmentDate ? ` ${t('staffMisc.confirmView.onDate', { date: new Date(c.firstInstallmentDate).toLocaleDateString('en-CA') })}` : ''}.
        </p>
      )}

      {c.specialArrangements && (
        <p className="text-gray-600"><span className="font-medium">{t('staffMisc.confirmView.specialArrangements')} </span>{c.specialArrangements}</p>
      )}
      {c.issueNote && (
        <p className="rounded bg-red-50 p-2 text-red-700"><span className="font-medium">{t('staffMisc.confirmView.issue')} </span>{c.issueNote}</p>
      )}
      {c.completedAt && (
        <p className="text-xs text-gray-400">
          {t('staffMisc.confirmView.confirmedBy', { name: anonymizeStaff ? REVIEWER_DISPLAY : c.confirmedBy?.name ?? 'GWA' })} · {new Date(c.completedAt).toLocaleString('en-CA')}
        </p>
      )}
    </div>
  );
}

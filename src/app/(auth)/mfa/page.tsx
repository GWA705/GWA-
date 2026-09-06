import { redirect } from 'next/navigation';
import { getMfaPendingUserId } from '@/lib/session';
import { getMfaTrustDays } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { getT } from '@/i18n/server';
import { MfaForm } from './MfaForm';

export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  const pending = await getMfaPendingUserId();
  if (!pending) redirect('/login');
  const [user, trustDays] = await Promise.all([
    prisma.user.findUnique({ where: { id: pending }, select: { mfaMethod: true } }),
    getMfaTrustDays(),
  ]);
  const method = user?.mfaMethod === 'EMAIL' ? 'EMAIL' : 'APP';
  const t = getT();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">{t('auth.twoFactorTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {method === 'EMAIL' ? t('auth.mfaEmailSubtitle') : t('auth.mfaAppSubtitle')}
          </p>
        </div>
        <div className="card p-6">
          <MfaForm method={method} trustDays={trustDays} />
        </div>
      </div>
    </div>
  );
}

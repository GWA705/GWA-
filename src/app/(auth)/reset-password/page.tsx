import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';
import { getT } from '@/i18n/server';
import { ResetPasswordForm } from './ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const session = await getSession();
  if (session) redirect(defaultLandingFor(session.role));
  const token = searchParams.token ?? '';
  const t = getT();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">{t('auth.setNewTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.setNewSubtitle')}</p>
        </div>
        <div className="card p-6">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4 text-sm text-gray-600">
              <p>{t('auth.missingToken')}</p>
              <Link href="/forgot-password" className="btn-primary inline-block">{t('auth.requestNewLink')}</Link>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getPasswordChangePendingUserId } from '@/lib/session';
import { PASSWORD_MAX_AGE_DAYS } from '@/lib/password';
import { getT } from '@/i18n/server';
import { ChangePasswordForm } from './ChangePasswordForm';

// Forced password change shown when an expired password is used to sign in.
export default async function ChangePasswordPage() {
  const userId = await getPasswordChangePendingUserId();
  if (!userId) redirect('/login');
  const t = getT();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">{t('auth.updateTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('auth.expiredNotice', { days: PASSWORD_MAX_AGE_DAYS })}
          </p>
        </div>
        <div className="card p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

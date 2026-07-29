import { redirect } from 'next/navigation';
import { getPasswordChangePendingUserId } from '@/lib/session';
import { PASSWORD_MAX_AGE_DAYS } from '@/lib/password';
import { ChangePasswordForm } from './ChangePasswordForm';

// Forced password change shown when an expired password is used to sign in.
export default async function ChangePasswordPage() {
  const userId = await getPasswordChangePendingUserId();
  if (!userId) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">Update your password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your password has expired. For security, passwords must be changed every {PASSWORD_MAX_AGE_DAYS} days.
            Set a new one to continue.
          </p>
        </div>
        <div className="card p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

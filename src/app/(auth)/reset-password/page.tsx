import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';
import { ResetPasswordForm } from './ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const session = await getSession();
  if (session) redirect(defaultLandingFor(session.role));
  const token = searchParams.token ?? '';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">Set a new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a strong password you haven&apos;t used here before.</p>
        </div>
        <div className="card p-6">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4 text-sm text-gray-600">
              <p>This reset link is missing its token. Please request a new one.</p>
              <Link href="/forgot-password" className="btn-primary inline-block">Request a new link</Link>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

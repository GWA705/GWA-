import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session) redirect(defaultLandingFor(session.role));

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your email and we&apos;ll send you a secure reset link.
          </p>
        </div>
        <div className="card p-6">
          <ForgotPasswordForm />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

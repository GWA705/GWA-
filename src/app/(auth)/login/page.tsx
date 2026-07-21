import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(defaultLandingFor(session.role));

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">GWA Credit Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          Authorized users only. All access is logged. Personal information is handled under
          PIPEDA and applicable provincial privacy law.
        </p>
      </div>
    </div>
  );
}

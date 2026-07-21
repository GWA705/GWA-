import { redirect } from 'next/navigation';
import { getMfaPendingUserId } from '@/lib/session';
import { MfaForm } from './MfaForm';

export default async function MfaPage() {
  const pending = await getMfaPendingUserId();
  if (!pending) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">Two-factor authentication</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter the code from your authenticator app.
          </p>
        </div>
        <div className="card p-6">
          <MfaForm />
        </div>
      </div>
    </div>
  );
}

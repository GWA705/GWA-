import { redirect } from 'next/navigation';
import { getMfaPendingUserId } from '@/lib/session';
import { prisma } from '@/lib/db';
import { MfaForm } from './MfaForm';

export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  const pending = await getMfaPendingUserId();
  if (!pending) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id: pending }, select: { mfaMethod: true } });
  const method = user?.mfaMethod === 'EMAIL' ? 'EMAIL' : 'APP';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">Two-factor authentication</h1>
          <p className="mt-1 text-sm text-gray-500">
            {method === 'EMAIL'
              ? 'We emailed you a 6-digit code. Enter it below.'
              : 'Enter the code from your authenticator app.'}
          </p>
        </div>
        <div className="card p-6">
          <MfaForm method={method} />
        </div>
      </div>
    </div>
  );
}

import { getSetting } from '@/lib/settings';
import { ONBOARD_CODE_KEY } from '@/lib/onboard';
import { OnboardForm } from './OnboardForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Request portal access — Georgian Water & Air',
  robots: { index: false, follow: false },
};

export default async function RequestAccessPage() {
  const open = !!((await getSetting(ONBOARD_CODE_KEY)) || '').trim();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Georgian Water &amp; Air</h1>
          <p className="mt-1 text-sm text-gray-600">Dealer Portal — request logins for your office</p>
        </div>

        {open ? (
          <OnboardForm />
        ) : (
          <div className="card p-8 text-center text-sm text-gray-600">
            This form isn&rsquo;t accepting submissions right now. Please contact Georgian Water &amp; Air to get set up.
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Handles personal information under PIPEDA and provincial privacy law.
        </p>
      </div>
    </div>
  );
}

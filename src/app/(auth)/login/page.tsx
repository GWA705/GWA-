import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';
import { getT } from '@/i18n/server';
import { isSpookySeason } from '@/lib/seasonal';
import { SpookyDecor } from '@/components/SpookyDecor';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(defaultLandingFor(session.role));
  const t = getT();
  // Decided on the server from the Toronto date, so it flips on in late October
  // and reverts on its own Nov 1 — with no flash of the wrong theme.
  const spooky = isSpookySeason();

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {spooky && <SpookyDecor />}
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">
            {spooky ? `🎃 ${t('auth.portalTitle')}` : t('auth.portalTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.signInToContinue')}</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          {t('auth.authorizedNotice')}
        </p>
      </div>
    </div>
  );
}

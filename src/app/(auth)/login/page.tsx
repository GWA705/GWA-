import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';
import { getT } from '@/i18n/server';
import { isSpookySeason } from '@/lib/seasonal';
import { activeLoginTheme } from '@/lib/loginTheme';
import { SeasonalLogin } from '@/components/auth/SeasonalLogin';
import { SpookyLogin } from './SpookyLogin';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(defaultLandingFor(session.role));

  // An admin-managed login theme (Admin → Login screen) wins when one is live —
  // scheduled for an occasion or set to always-on. Otherwise the built-in
  // Halloween skin shows during the spooky season (both decided server-side from
  // the Toronto date, so no flicker and they revert on their own); the normal
  // login otherwise.
  const theme = await activeLoginTheme();
  if (theme) return <SeasonalLogin bgSrc={theme.src} accent={theme.accent ?? undefined} />;
  if (isSpookySeason()) return <SpookyLogin />;

  const t = getT();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand-700">{t('auth.portalTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.signInToContinue')}</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">{t('auth.authorizedNotice')}</p>
      </div>
    </div>
  );
}

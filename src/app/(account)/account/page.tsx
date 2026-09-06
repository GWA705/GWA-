import Link from 'next/link';
import { requireSession, defaultLandingFor, adminLandingFor } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptMfaSecret, buildMfaEnrollment } from '@/lib/mfa';
import { beginMfaAction, replayWelcomeTourAction, signOutEverywhereAction } from '@/app/(account)/actions';
import { logoutAction } from '@/app/(auth)/actions';
import { DisableMfaForm } from './DisableMfaForm';
import { ConfirmMfaForm } from './ConfirmMfaForm';
import { StartEmailMfaButton, ConfirmEmailMfaForm } from './EmailMfaForms';
import { ProfileForm } from './ProfileForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { DesktopNotifications } from '@/components/DesktopNotifications';
import { InstallApp } from '@/components/InstallApp';
import { isPasswordExpired, PASSWORD_MAX_AGE_DAYS } from '@/lib/password';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireSession();
  const t = getT();
  const [user, recentLogins] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.auditLog.findMany({
      where: { actorId: session.userId, action: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);
  if (!user) return null;

  const pwExpired = isPasswordExpired(user.passwordChangedAt);

  const appPending = !user.mfaEnabled && !!user.mfaSecretEnc;
  const emailPending =
    !user.mfaEnabled &&
    !user.mfaSecretEnc &&
    !!user.mfaEmailCodeHash &&
    !!user.mfaEmailCodeExpiresAt &&
    user.mfaEmailCodeExpiresAt.getTime() > Date.now();
  let qrDataUrl = '';
  let otpauthUrl = '';
  if (appPending && user.mfaSecretEnc) {
    const secret = decryptMfaSecret(user.mfaSecretEnc);
    const enrollment = await buildMfaEnrollment(user.email, secret);
    qrDataUrl = enrollment.qrDataUrl;
    otpauthUrl = enrollment.otpauthUrl;
  }

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';

  // Where "Back" should go. For an admin this respects their granted sections
  // (an admin with none resolves to /account — i.e. nowhere to go). When there's
  // no real destination we hide the Back link and explain why, so a freshly
  // created admin who hasn't been granted access isn't stuck bouncing here.
  const landing = session.role === 'ADMIN' ? adminLandingFor(session) : defaultLandingFor(session.role);
  const stranded = landing === '/account';

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t('account.title')}</h1>
        <div className="flex items-center gap-4">
          {!stranded && (
            <Link href={landing} className="text-sm text-gray-500 hover:underline">
              {t('account.back')}
            </Link>
          )}
          {/* Always give a way out — this page has no nav shell of its own. */}
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-gray-500 hover:underline">{t('account.signOut')}</button>
          </form>
        </div>
      </div>

      {stranded && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">{t('account.strandedTitle')}</h2>
          <p className="mt-1 text-sm text-amber-800">{t('account.strandedBody')}</p>
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('account.profileNotifications')}</h2>
        <ProfileForm
          profile={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            notificationEmail: user.notificationEmail,
            notifyStatusUpdates: user.notifyStatusUpdates,
            notifyNewNotes: user.notifyNewNotes,
            notifyNewDocuments: user.notifyNewDocuments,
            notifyAttentionAlerts: user.notifyAttentionAlerts,
            notifyIdleReminders: user.notifyIdleReminders,
            notifyNewLeads: user.notifyNewLeads,
            isStaff,
          }}
        />
      </section>

      <section className="card p-6">
        <InstallApp />
      </section>

      <section className="card p-6">
        <DesktopNotifications />
      </section>

      {session.role === 'DEALER_USER' && (
        <section className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">{t('account.portalTour')}</h2>
          <p className="mb-4 text-sm text-gray-500">{t('account.portalTourBody')}</p>
          <form action={replayWelcomeTourAction}>
            <button type="submit" className="btn-secondary text-sm">{t('account.replayTour')}</button>
          </form>
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('account.password')}</h2>
        <p className="mb-4 text-sm text-gray-500">
          {user.passwordChangedAt
            ? t('account.lastChanged', { date: user.passwordChangedAt.toLocaleDateString('en-CA') })
            : t('account.setFreshPassword')}{' '}
          {t('account.mustChangeEvery', { days: PASSWORD_MAX_AGE_DAYS })}
        </p>
        {pwExpired && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {t('account.pwExpired')}
          </div>
        )}
        <ChangePasswordForm />
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">{t('account.twoFactor')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('account.twoFactorBody')}</p>

        {user.mfaEnabled ? (
          <div className="mt-4">
            <span className="badge bg-green-100 text-green-800">
              {t('account.enabledPrefix')} · {user.mfaMethod === 'EMAIL' ? t('account.emailMethod') : t('account.appMethod')}
            </span>
            <DisableMfaForm />
          </div>
        ) : appPending ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-700">{t('account.scanQr')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={t('account.qrAlt')} className="h-44 w-44 rounded border border-gray-200" />
            <p className="break-all text-xs text-gray-400">{otpauthUrl}</p>
            <ConfirmMfaForm />
          </div>
        ) : emailPending ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-700">{t('account.emailedCode', { email: user.notificationEmail || user.email })}</p>
            <ConfirmEmailMfaForm />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={beginMfaAction}>
              <button type="submit" className="btn-primary">{t('account.useApp')}</button>
            </form>
            <StartEmailMfaButton />
          </div>
        )}

        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800">{t('account.signedElsewhere')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('account.signOutEverywhereBody')}</p>
          <form action={signOutEverywhereAction} className="mt-3">
            <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {t('account.signOutAllDevices')}
            </button>
          </form>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('account.recentActivity')}</h2>
        <p className="mb-4 text-sm text-gray-500">{t('account.recentActivityBody')}</p>
        {recentLogins.length === 0 ? (
          <p className="text-sm text-gray-500">{t('account.noActivity')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">{t('account.when')}</th>
                  <th className="py-2 pr-4">{t('account.result')}</th>
                  <th className="py-2">{t('account.ipAddress')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLogins.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-4 text-gray-700">{l.createdAt.toLocaleString('en-CA')}</td>
                    <td className="py-2 pr-4">
                      <span className={`badge ${l.action === 'LOGIN_SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                        {l.action === 'LOGIN_SUCCESS' ? t('account.success') : t('account.failed')}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{l.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

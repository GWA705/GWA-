import Link from 'next/link';
import { requireSession, defaultLandingFor } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptMfaSecret, buildMfaEnrollment } from '@/lib/mfa';
import { beginMfaAction, replayWelcomeTourAction } from '@/app/(account)/actions';
import { DisableMfaForm } from './DisableMfaForm';
import { ConfirmMfaForm } from './ConfirmMfaForm';
import { StartEmailMfaButton, ConfirmEmailMfaForm } from './EmailMfaForms';
import { ProfileForm } from './ProfileForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { DesktopNotifications } from '@/components/DesktopNotifications';
import { isPasswordExpired, PASSWORD_MAX_AGE_DAYS } from '@/lib/password';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireSession();
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">My account</h1>
        <Link href={defaultLandingFor(session.role)} className="text-sm text-gray-500 hover:underline">
          ← Back
        </Link>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Profile &amp; notifications</h2>
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
            isStaff,
          }}
        />
      </section>

      <section className="card p-6">
        <DesktopNotifications />
      </section>

      {session.role === 'DEALER_USER' && (
        <section className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Portal tour</h2>
          <p className="mb-4 text-sm text-gray-500">
            New here or need a refresher? Replay the quick welcome tour of the portal.
          </p>
          <form action={replayWelcomeTourAction}>
            <button type="submit" className="btn-secondary text-sm">Replay the welcome tour</button>
          </form>
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Password</h2>
        <p className="mb-4 text-sm text-gray-500">
          {user.passwordChangedAt
            ? `Last changed ${user.passwordChangedAt.toLocaleDateString('en-CA')}.`
            : 'Set a fresh password to start the rotation clock.'}{' '}
          Passwords must be changed every {PASSWORD_MAX_AGE_DAYS} days.
        </p>
        {pwExpired && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Your password has expired — please choose a new one below.
          </div>
        )}
        <ChangePasswordForm />
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">Two-factor authentication (2FA)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add a second step at sign-in. Choose an <strong>authenticator app</strong> (most secure —
          Google Authenticator, Authy, 1Password) or have a <strong>code emailed</strong> to you.
          Strongly recommended for all staff.
        </p>

        {user.mfaEnabled ? (
          <div className="mt-4">
            <span className="badge bg-green-100 text-green-800">
              Enabled · {user.mfaMethod === 'EMAIL' ? 'Email codes' : 'Authenticator app'}
            </span>
            <DisableMfaForm />
          </div>
        ) : appPending ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-700">
              Scan this QR code with your authenticator app, then enter the code to finish.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="2FA QR code" className="h-44 w-44 rounded border border-gray-200" />
            <p className="break-all text-xs text-gray-400">{otpauthUrl}</p>
            <ConfirmMfaForm />
          </div>
        ) : emailPending ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-700">
              We emailed a 6-digit code to <strong>{user.notificationEmail || user.email}</strong>. Enter it
              below to turn on email 2FA.
            </p>
            <ConfirmEmailMfaForm />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={beginMfaAction}>
              <button type="submit" className="btn-primary">Use an authenticator app</button>
            </form>
            <StartEmailMfaButton />
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Recent sign-in activity</h2>
        <p className="mb-4 text-sm text-gray-500">
          The most recent sign-ins on your account, with the IP address they came from. If you don&apos;t
          recognize one, change your password and contact GWA.
        </p>
        {recentLogins.length === 0 ? (
          <p className="text-sm text-gray-500">No sign-in activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLogins.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-4 text-gray-700">{l.createdAt.toLocaleString('en-CA')}</td>
                    <td className="py-2 pr-4">
                      <span className={`badge ${l.action === 'LOGIN_SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                        {l.action === 'LOGIN_SUCCESS' ? 'Success' : 'Failed'}
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

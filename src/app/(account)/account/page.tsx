import Link from 'next/link';
import { requireSession, defaultLandingFor } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptMfaSecret, buildMfaEnrollment } from '@/lib/mfa';
import { beginMfaAction, disableMfaAction } from '@/app/(account)/actions';
import { ConfirmMfaForm } from './ConfirmMfaForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;

  const pending = !user.mfaEnabled && !!user.mfaSecretEnc;
  let qrDataUrl = '';
  let otpauthUrl = '';
  if (pending && user.mfaSecretEnc) {
    const secret = decryptMfaSecret(user.mfaSecretEnc);
    const enrollment = await buildMfaEnrollment(user.email, secret);
    qrDataUrl = enrollment.qrDataUrl;
    otpauthUrl = enrollment.otpauthUrl;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Account security</h1>
        <Link href={defaultLandingFor(session.role)} className="text-sm text-gray-500 hover:underline">
          ← Back
        </Link>
      </div>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">Two-factor authentication (2FA)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Protect your account with a time-based one-time code from an authenticator app
          (Google Authenticator, Authy, 1Password, etc.). Strongly recommended for all staff.
        </p>

        {user.mfaEnabled ? (
          <div className="mt-4">
            <span className="badge bg-green-100 text-green-800">Enabled</span>
            <form action={disableMfaAction} className="mt-4">
              <button type="submit" className="btn-secondary">Disable 2FA</button>
            </form>
          </div>
        ) : pending ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-700">
              Scan this QR code with your authenticator app, then enter the code to finish.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="2FA QR code" className="h-44 w-44 rounded border border-gray-200" />
            <p className="break-all text-xs text-gray-400">{otpauthUrl}</p>
            <ConfirmMfaForm />
          </div>
        ) : (
          <form action={beginMfaAction} className="mt-4">
            <button type="submit" className="btn-primary">Enable 2FA</button>
          </form>
        )}
      </section>
    </div>
  );
}

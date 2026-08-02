import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getMfaEnrollPendingUserId } from '@/lib/session';
import { decryptMfaSecret, buildMfaEnrollment } from '@/lib/mfa';
import { emailEnabled } from '@/lib/email';
import { SetupTwoFactor } from './SetupTwoFactor';

export const dynamic = 'force-dynamic';

export default async function SetupTwoFactorPage() {
  const userId = await getMfaEnrollPendingUserId();
  if (!userId) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) redirect('/login');

  // If an authenticator secret is already pending (user clicked "use an app"),
  // build the QR to show. Otherwise the page starts on the email-code method.
  let qrDataUrl = '';
  let otpauthUrl = '';
  if (user.mfaSecretEnc && !user.mfaEnabled) {
    const secret = decryptMfaSecret(user.mfaSecretEnc);
    const enrollment = await buildMfaEnrollment(user.email, secret);
    qrDataUrl = enrollment.qrDataUrl;
    otpauthUrl = enrollment.otpauthUrl;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Set up two-factor authentication</h1>
        <p className="mt-2 text-sm text-gray-500">
          For your security, this account needs a second step at sign-in. It only takes a minute — set
          it up once and you&apos;re done.
        </p>
      </div>
      <div className="card p-6">
        <SetupTwoFactor
          email={user.email}
          emailEnabled={emailEnabled()}
          appPending={!!user.mfaSecretEnc && !user.mfaEnabled}
          qrDataUrl={qrDataUrl}
          otpauthUrl={otpauthUrl}
        />
      </div>
    </div>
  );
}

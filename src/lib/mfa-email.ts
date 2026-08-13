import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { encryptString, decryptString } from './crypto';
import { generateEmailCode, hashEmailCode, EMAIL_CODE_TTL_MINUTES } from './mfa';

/**
 * Issue the email 2FA code, store its hash (+ an encrypted copy) and expiry on
 * the user, and email it. Used both at login (EMAIL method) and when enrolling.
 *
 * Key behaviour: if the user already has a still-valid code, we RESEND THE SAME
 * code (and extend its expiry) instead of generating a new one. That way a
 * re-login or a "resend" during one sign-in attempt doesn't invalidate a code
 * the user is about to type — which is exactly what broke when a new email
 * sender got greylisted and codes arrived slowly/out of order. Pass
 * `forceNew` to always mint a fresh code (e.g. enrollment).
 *
 * Returns whether the email actually sent (false in log-only mode / on error).
 */
export async function issueEmailMfaCode(
  user: {
    id: string;
    email: string;
    notificationEmail: string | null;
  },
  opts: { forceNew?: boolean } = {},
): Promise<{ sent: boolean }> {
  // Reuse a still-valid code (with a little headroom) so every email in one
  // attempt carries the same digits.
  let code: string | null = null;
  if (!opts.forceNew) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEmailCodeEnc: true, mfaEmailCodeExpiresAt: true },
    });
    const stillValid =
      existing?.mfaEmailCodeEnc &&
      existing.mfaEmailCodeExpiresAt &&
      existing.mfaEmailCodeExpiresAt.getTime() > Date.now() + 60_000;
    if (stillValid) {
      try {
        code = decryptString(existing!.mfaEmailCodeEnc!);
      } catch {
        code = null;
      }
    }
  }
  if (!code) code = generateEmailCode();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEmailCodeHash: hashEmailCode(code),
      mfaEmailCodeEnc: encryptString(code),
      mfaEmailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
    },
  });
  const result = await sendEmail({
    to: user.notificationEmail || user.email,
    subject: 'Your GWA Dealer Portal sign-in code',
    html: renderEmail({
      heading: 'Your sign-in code',
      intro: `Enter this code to finish signing in. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
      bodyHtml: `<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:10px 0;color:#111827;">${code}</p>`,
      footerNote: 'If you did not try to sign in, you can ignore this email — your password still protects your account.',
    }),
  });
  return { sent: result.sent };
}

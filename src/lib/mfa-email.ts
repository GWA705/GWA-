import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { generateEmailCode, hashEmailCode, EMAIL_CODE_TTL_MINUTES } from './mfa';

/**
 * Generate a fresh email 2FA code, store its hash + expiry on the user, and
 * email it. Used both at login (EMAIL method) and when enrolling in email 2FA.
 * Returns whether the email actually sent (false in log-only mode / on error).
 */
export async function issueEmailMfaCode(user: {
  id: string;
  email: string;
  notificationEmail: string | null;
}): Promise<{ sent: boolean }> {
  const code = generateEmailCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEmailCodeHash: hashEmailCode(code),
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

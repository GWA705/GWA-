import { prisma } from './db';
import { sendEmail } from './email';
import { PASS_THRESHOLD } from './training';
import { traineeEmailHtml, officeEmailHtml } from './training-email-template';

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

/**
 * Best-effort confirmation email after a lead generator completes the Home Depot
 * training. Sends a plain confirmation to the trainee and notifies the office's
 * portal users with a link to the certificate record. Never throws — a mail
 * problem must not fail the training submission. No sensitive personal info in
 * the body; the office link requires a portal login.
 *
 * While SMTP is in log-only mode this simply logs, so it is safe to call now and
 * "comes alive" the moment the dedicated SES sender is switched on.
 */
export async function sendTrainingCertificationEmails(params: {
  certId: string;
  dealerId: string;
  traineeName: string;
  traineeEmail: string;
  score: number;
  passed: boolean;
}): Promise<void> {
  const { certId, dealerId, traineeName, traineeEmail, score, passed } = params;
  try {
    const [dealer, officeUsers] = await Promise.all([
      prisma.dealer.findUnique({ where: { id: dealerId }, select: { name: true } }),
      prisma.user.findMany({
        where: { dealerId, role: 'DEALER_USER', active: true },
        select: { email: true, notificationEmail: true },
      }),
    ]);
    const officeName = dealer?.name || 'your office';
    const base = appUrl();
    const date = new Date().toLocaleDateString('en-CA');
    const firstName = (traineeName || '').trim().split(/\s+/)[0] || '';

    // 1) Trainee confirmation — designed HTML certificate email.
    if (traineeEmail) {
      await sendEmail({
        to: traineeEmail,
        subject: passed ? 'You’re certified — Home Depot in-store training ✓' : 'Your Home Depot training result',
        html: traineeEmailHtml({ appUrl: base, firstName, office: officeName, score, passed, passThreshold: PASS_THRESHOLD, date }),
      });
    }

    // 2) Office notification with a link to the full record (login required).
    const officeTo = Array.from(
      new Set(officeUsers.map((u) => (u.notificationEmail || u.email || '').trim()).filter(Boolean)),
    );
    if (officeTo.length) {
      const link = `${base}/dealer/training/${certId}`;
      await sendEmail({
        to: officeTo.join(', '),
        subject: `Training completed — ${traineeName || 'lead generator'} (${score}%)`,
        html: officeEmailHtml({ appUrl: base, traineeName, office: officeName, score, passed, link, date }),
      });
    }
  } catch (e) {
    console.error('[training] certification email failed', e);
  }
}

import { prisma } from './db';
import { sendEmail } from './email';
import { PASS_THRESHOLD } from './training';

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
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
    const result = passed ? 'passed' : 'did not reach the passing score';

    // 1) Trainee confirmation.
    if (traineeEmail) {
      const html = `
        <p>Hi ${esc(traineeName || 'there')},</p>
        <p>Thank you for completing the Home Depot in-store training with <strong>${esc(officeName)}</strong>.</p>
        <p>Your result: <strong>${score}%</strong> — you ${result} (pass mark ${PASS_THRESHOLD}%).</p>
        ${passed
          ? `<p>You're all set. Your office has a copy of your certificate on file.</p>`
          : `<p>You can retake the training using the same link from your office whenever you're ready.</p>`}
        <p>— Georgian Water &amp; Air</p>`;
      await sendEmail({
        to: traineeEmail,
        subject: passed ? 'Your Home Depot training certificate' : 'Your Home Depot training result',
        html,
      });
    }

    // 2) Office notification with a link to the full record (login required).
    const officeTo = Array.from(
      new Set(officeUsers.map((u) => (u.notificationEmail || u.email || '').trim()).filter(Boolean)),
    );
    if (officeTo.length) {
      const link = `${appUrl()}/dealer/training/${certId}`;
      const html = `
        <p>A lead generator has completed the Home Depot training.</p>
        <p><strong>${esc(traineeName || 'Trainee')}</strong> — score ${score}% (${passed ? 'passed' : 'incomplete'}).</p>
        <p>View the certificate record: <a href="${link}">${link}</a></p>
        <p>— GWA Dealer Portal</p>`;
      await sendEmail({
        to: officeTo.join(', '),
        subject: `Training completed — ${traineeName || 'lead generator'} (${score}%)`,
        html,
      });
    }
  } catch (e) {
    console.error('[training] certification email failed', e);
  }
}

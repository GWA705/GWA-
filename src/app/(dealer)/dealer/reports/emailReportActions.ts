'use server';

import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/ratelimit';

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

/**
 * Email the signed-in dealer a link to a report they're viewing, so they can pull
 * it up (and print / save as PDF) from anywhere. Sends ONLY to the user's own
 * account email — never a free-text recipient — so it can't be used as a relay.
 * The path is validated to be an in-app dealer-reports URL.
 */
export async function emailDealerReport(
  pathAndQuery: string,
  title: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user))) return { ok: false, message: 'No report access.' };

  // Only allow our own dealer-reports paths (defence against open-redirect/relay).
  if (!/^\/dealer\/reports(\/|\?|$)/.test(pathAndQuery)) {
    return { ok: false, message: 'That link can’t be emailed.' };
  }

  const rl = await rateLimit(`report-email:${user.userId}`, 10, 300);
  if (!rl.ok) return { ok: false, message: 'Too many emails just now — try again in a few minutes.' };

  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true, notificationEmail: true, name: true },
  });
  const to = me?.notificationEmail || me?.email;
  if (!to) return { ok: false, message: 'No email on file for your account.' };

  const cleanTitle = (title || 'Your report').slice(0, 120);
  const url = `${appUrl()}${pathAndQuery}`;

  const res = await sendEmail({
    to,
    subject: `${cleanTitle} — Georgian Water & Air`,
    html: renderEmail({
      heading: cleanTitle,
      intro: `Here’s the report you asked to keep, ${me?.name?.split(' ')[0] || ''}.`.trim(),
      bodyHtml: `<p style="margin:0 0 12px;font-size:14px;color:#374151;">Open it any time with the button below. From the report you can Print or Save as PDF.</p>`,
      ctaLabel: 'Open the report',
      ctaUrl: url,
    }),
  });

  if (!res.sent) return { ok: false, message: 'Couldn’t send the email just now — please try again.' };

  await audit({ actorId: user.userId, action: 'USER_UPDATE', entityType: 'Report', detail: `Emailed report link to self: ${cleanTitle}` });
  return { ok: true, message: `Sent to ${to}.` };
}

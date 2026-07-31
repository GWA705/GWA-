import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';

/**
 * 2-hour "new deal not looked at" alert.
 *
 * A deal counts as "not looked at" when it is a fresh submission that no
 * reviewer has picked up yet: status SUBMITTED (new application) or
 * FUNDING_SUBMITTED (funding package), with no reviewer action recorded
 * (lastReviewerActionAt is null). When such a deal has been waiting longer than
 * WAIT_MINUTES, all active reviewers/admins (who haven't opted out) get one
 * email listing the deals. It re-sends at most once per ~2h window so a deal
 * that stays untouched keeps nudging without spamming.
 *
 * Only runs during business hours (local Ontario time). A deal that crosses the
 * 2-hour mark overnight is alerted at the next 8am run.
 */

const WAIT_MINUTES = 120;
const BUSINESS_START_HOUR = 8; // 8:00 am
const BUSINESS_END_HOUR = 22; // up to 10:00 pm (22:00)
const BUSINESS_TZ = 'America/Toronto';

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

// A short, low-sensitivity label — first name + last initial (e.g. "John D.").
function dealLabel(app: { applicantFirstName: string; applicantLastName: string }): string {
  const first = (app.applicantFirstName || '').trim();
  const lastInitial = (app.applicantLastName || '').trim().charAt(0);
  const label = `${first}${lastInitial ? ` ${lastInitial}.` : ''}`.trim();
  return label || 'a deal';
}

/** Current hour (0–23) in the business timezone, DST-aware. */
export function currentHourInTz(now: Date, tz: string = BUSINESS_TZ): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).format(now);
  // "24" can be returned for midnight in some environments; normalize to 0.
  return parseInt(h, 10) % 24;
}

export function isBusinessHours(now: Date, tz: string = BUSINESS_TZ): boolean {
  const hour = currentHourInTz(now, tz);
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

export interface SlaAlertResult {
  ran: boolean;
  reason?: string;
  deals: number;
  recipients: number;
}

export async function runAttentionAlerts(now: Date = new Date()): Promise<SlaAlertResult> {
  if (!isBusinessHours(now)) {
    return { ran: false, reason: 'outside business hours', deals: 0, recipients: 0 };
  }

  const waitCutoff = new Date(now.getTime() - WAIT_MINUTES * 60_000);
  // Only re-alert a deal whose last alert was more than one wait-window ago.
  const resendCutoff = waitCutoff;

  const deals = await prisma.application.findMany({
    where: {
      status: { in: ['SUBMITTED', 'FUNDING_SUBMITTED'] },
      lastReviewerActionAt: null, // never looked at by a reviewer
      // Waiting since the dealer acted (submitted/uploaded); fall back to createdAt.
      OR: [
        { lastDealerActionAt: { lte: waitCutoff } },
        { lastDealerActionAt: null, createdAt: { lte: waitCutoff } },
      ],
      // Not alerted yet, or last alert is older than one wait-window.
      AND: [{ OR: [{ attentionAlertSentAt: null }, { attentionAlertSentAt: { lte: resendCutoff } }] }],
    },
    include: { dealer: true },
    orderBy: { createdAt: 'asc' },
  });

  if (deals.length === 0) {
    return { ran: true, reason: 'no deals waiting', deals: 0, recipients: 0 };
  }

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true, notifyAttentionAlerts: true },
  });

  const lines = deals
    .map((d) => {
      const since = d.lastDealerActionAt ?? d.createdAt;
      const mins = Math.floor((now.getTime() - since.getTime()) / 60_000);
      const hrs = Math.floor(mins / 60);
      const remM = mins % 60;
      const wait = hrs > 0 ? `${hrs}h ${remM}m` : `${remM}m`;
      const kind = d.status === 'FUNDING_SUBMITTED' ? 'Funding package' : 'New application';
      return `<li style="margin:4px 0;">${dealLabel(d)} — ${d.dealer.name} · ${kind} · waiting ${wait}</li>`;
    })
    .join('');

  const count = deals.length;
  const heading = `${count} deal${count === 1 ? '' : 's'} waiting over 2 hours`;
  const intro =
    `The following ${count === 1 ? 'deal has' : 'deals have'} been waiting more than 2 hours ` +
    `and no reviewer has picked ${count === 1 ? 'it' : 'them'} up yet.`;
  const html = renderEmail({
    heading,
    intro,
    bodyHtml: `<ul style="padding-left:18px;margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">${lines}</ul>`,
    ctaLabel: 'Open the review queue',
    ctaUrl: `${appUrl()}/staff`,
  });

  let sent = 0;
  for (const u of recipients) {
    const res = await sendEmail({
      to: u.notificationEmail || u.email,
      subject: `⏰ ${count} deal${count === 1 ? '' : 's'} waiting over 2 hours`,
      html,
    });
    if (res.sent) sent += 1;
  }

  // Mark these deals as alerted so they don't re-fire until the next window.
  await prisma.application.updateMany({
    where: { id: { in: deals.map((d) => d.id) } },
    data: { attentionAlertSentAt: now },
  });

  return { ran: true, deals: deals.length, recipients: recipients.length };
}

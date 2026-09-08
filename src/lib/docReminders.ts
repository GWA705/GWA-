import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { sendPushToUser } from './push';
import { currentHourInTz } from './sla';
import { getSetting, setSetting } from './settings';
import { businessDocType, DOC_EXPIRY_REMIND_DAYS_BEFORE } from './constants';
import { daysUntil } from './dealerDocs';

/**
 * Renewal reminders for dealer business documents (WSIB, WCB, …).
 *
 * A dealer uploads a clearance certificate with its expiry date; this engine
 * emails (and pushes to) that dealer's users ahead of expiry so they replace it
 * before it lapses — GWA no longer has to chase paperwork. The first nudge goes
 * out `daysBefore` days ahead (default 7 = one week, as requested), then repeats
 * on a weekly cadence through expiry and while overdue, until the document is
 * replaced (which resets the counter) or the retry cap is reached.
 *
 * Driven by a scheduler calling runDocExpiryReminders() (see
 * /api/cron/doc-expiry-reminders). Off-hours runs simply no-op.
 */

export interface DocReminderConfig {
  enabled: boolean;
  timezone: string;
  quietStartHour: number;
  quietEndHour: number;
  daysBefore: number; // first reminder this many days before expiry
  resendGapDays: number; // minimum days between repeat reminders for one doc
  maxReminders: number; // stop after this many (it's on the admin dashboard)
}

export const DEFAULT_DOC_REMINDER_CONFIG: DocReminderConfig = {
  enabled: true,
  timezone: 'America/Toronto',
  quietStartHour: 8,
  quietEndHour: 21,
  daysBefore: DOC_EXPIRY_REMIND_DAYS_BEFORE,
  resendGapDays: 7,
  maxReminders: 6,
};

const SETTING_KEY = 'reminders.docExpiry';

export async function getDocReminderConfig(): Promise<DocReminderConfig> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return { ...DEFAULT_DOC_REMINDER_CONFIG };
  try {
    return { ...DEFAULT_DOC_REMINDER_CONFIG, ...(JSON.parse(raw) as Partial<DocReminderConfig>) };
  } catch {
    return { ...DEFAULT_DOC_REMINDER_CONFIG };
  }
}

export async function setDocReminderConfig(patch: Partial<DocReminderConfig>): Promise<DocReminderConfig> {
  const next = { ...(await getDocReminderConfig()), ...patch };
  await setSetting(SETTING_KEY, JSON.stringify(next));
  return next;
}

export interface DocReminderRunResult {
  ran: boolean;
  reason?: string;
  docs: number; // documents that got a reminder
  emails: number;
  pushes: number;
}

function docLabel(type: string, label: string | null): string {
  return label || businessDocType(type)?.label || 'a business document';
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

/**
 * Sweep every dealer document with an expiry, and send the due renewal
 * reminders. Best-effort: a send failure never throws out of the run.
 */
export async function runDocExpiryReminders(now: Date = new Date()): Promise<DocReminderRunResult> {
  const cfg = await getDocReminderConfig();
  if (!cfg.enabled) return { ran: false, reason: 'doc reminders are turned off', docs: 0, emails: 0, pushes: 0 };

  const hour = currentHourInTz(now, cfg.timezone);
  if (hour < cfg.quietStartHour || hour >= cfg.quietEndHour) {
    return { ran: false, reason: 'outside sending hours', docs: 0, emails: 0, pushes: 0 };
  }

  // Candidates: have an expiry, already inside the reminder window
  // (expiry <= now + daysBefore), and not past the retry cap.
  const windowEnd = new Date(now.getTime() + cfg.daysBefore * 86_400_000);
  const candidates = await prisma.dealerDocument.findMany({
    where: {
      expiryDate: { not: null, lte: windowEnd },
      remindersSent: { lt: cfg.maxReminders },
    },
    include: { dealer: { select: { id: true, name: true } } },
    take: 2000,
  });
  if (candidates.length === 0) return { ran: true, reason: 'nothing due', docs: 0, emails: 0, pushes: 0 };

  const resendGapMs = cfg.resendGapDays * 86_400_000;

  // Recipients per dealer, fetched once.
  const dealerIds = Array.from(new Set(candidates.map((d) => d.dealerId)));
  const users = await prisma.user.findMany({
    where: { role: 'DEALER_USER', active: true, dealerId: { in: dealerIds } },
    select: { id: true, email: true, notificationEmail: true, dealerId: true },
  });
  const usersByDealer = new Map<string, typeof users>();
  for (const u of users) {
    if (!u.dealerId) continue;
    const arr = usersByDealer.get(u.dealerId) ?? [];
    arr.push(u);
    usersByDealer.set(u.dealerId, arr);
  }

  let docsReminded = 0;
  let emails = 0;
  let pushes = 0;

  for (const doc of candidates) {
    if (doc.lastRemindedAt && now.getTime() - doc.lastRemindedAt.getTime() < resendGapMs) continue;

    const recipients = usersByDealer.get(doc.dealerId) ?? [];
    if (recipients.length === 0) continue;

    const daysLeft = daysUntil(doc.expiryDate, now) ?? 0;
    const name = docLabel(doc.type, doc.label);
    const expiryStr = doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const overdue = daysLeft < 0;
    const whenPhrase = overdue
      ? `expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
      : daysLeft === 0
        ? 'expires today'
        : `expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

    const subject = `${overdue ? '⚠️ Expired: ' : 'Renewal needed: '}${name} — Georgian Water & Air`;
    const html = renderEmail({
      heading: overdue ? 'A business document has expired' : 'A business document is expiring soon',
      intro: `Your ${name} for ${doc.dealer.name} ${whenPhrase}${expiryStr ? ` (${expiryStr})` : ''}.`,
      bodyHtml: `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">Please upload the renewed document so your file stays current. It only takes a minute — the portal reads the new expiry date for you.</p>`,
      ctaLabel: 'Upload the renewal',
      ctaUrl: `${appUrl()}/dealer/documents`,
    });

    let emailed = 0;
    let pushed = 0;
    for (const u of recipients) {
      // eslint-disable-next-line no-await-in-loop
      const res = await sendEmail({ to: u.notificationEmail || u.email, subject, html });
      if (res.sent) emailed += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        await sendPushToUser(u.id, { title: subject, body: `${name} — ${whenPhrase}`, url: '/dealer/documents', tag: `doc-${doc.id}` });
        pushed += 1;
      } catch {
        /* best-effort */
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await prisma.dealerDocument.update({
      where: { id: doc.id },
      data: { remindersSent: { increment: 1 }, lastRemindedAt: now },
    });

    docsReminded += 1;
    emails += emailed;
    pushes += pushed;
  }

  return { ran: true, docs: docsReminded, emails, pushes };
}

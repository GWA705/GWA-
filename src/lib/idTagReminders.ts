import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { sendPushToUser } from './push';
import { currentHourInTz } from './sla';
import { getSetting, setSetting } from './settings';
import { daysUntil } from './idTag';

/**
 * Home Depot ID-tag expiry reminders + the monthly office roster check-up.
 *
 * Expiry: every active badge (status ACTIVE / TAG_ISSUED) with a valid-until
 * date gets a nudge to the rep and their local office at 30, 15, 10 and 3 days
 * out (and once expired), so no one lapses. Each threshold fires once; renewing
 * the card (changing validUntil) restarts the cycle.
 *
 * Monthly: on the first run each month, every office gets a "who's still active?"
 * roster, with anyone expiring this month flagged, so leavers can be removed.
 *
 * Driven by a scheduler calling runIdTagReminders() (see
 * /api/cron/id-tag-reminders). Off-hours runs simply no-op.
 */

export const ID_TAG_REMIND_THRESHOLDS = [30, 15, 10, 3] as const;

export interface IdTagReminderConfig {
  enabled: boolean;
  timezone: string;
  quietStartHour: number;
  quietEndHour: number;
}

export const DEFAULT_ID_TAG_REMINDER_CONFIG: IdTagReminderConfig = {
  enabled: true,
  timezone: 'America/Toronto',
  quietStartHour: 8,
  quietEndHour: 21,
};

const CONFIG_KEY = 'reminders.idTagExpiry';
const MONTHLY_KEY = 'idTag.monthlyCheckup.lastRun';

export async function getIdTagReminderConfig(): Promise<IdTagReminderConfig> {
  const raw = await getSetting(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_ID_TAG_REMINDER_CONFIG };
  try {
    return { ...DEFAULT_ID_TAG_REMINDER_CONFIG, ...(JSON.parse(raw) as Partial<IdTagReminderConfig>) };
  } catch {
    return { ...DEFAULT_ID_TAG_REMINDER_CONFIG };
  }
}

export async function setIdTagReminderConfig(patch: Partial<IdTagReminderConfig>): Promise<IdTagReminderConfig> {
  const next = { ...(await getIdTagReminderConfig()), ...patch };
  await setSetting(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dateStr(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}

function whenPhrase(daysLeft: number): string {
  if (daysLeft < 0) return `expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'expires today';
  return `expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
}

/** The tightest crossed threshold not yet sent, or null when nothing is due. */
function dueThreshold(daysLeft: number, stage: number | null): number | null {
  const crossed = ID_TAG_REMIND_THRESHOLDS.filter((t) => daysLeft <= t);
  if (crossed.length === 0) return null;
  const tightest = Math.min(...crossed);
  if (stage === null || tightest < stage) return tightest;
  return null;
}

/** Month key (YYYY-MM) in the given timezone. */
function monthKey(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || '';
  const m = parts.find((p) => p.type === 'month')?.value || '';
  return `${y}-${m}`;
}

export interface IdTagReminderRunResult {
  ran: boolean;
  reason?: string;
  reminded: number;   // badges that got an expiry reminder
  emails: number;
  monthlyOffices: number; // offices that got the monthly check-up
}

/** Office recipients (dealer users) for a set of dealer ids. */
async function officeRecipients(dealerIds: string[]): Promise<Map<string, { id: string; email: string }[]>> {
  const users = await prisma.user.findMany({
    where: { role: 'DEALER_USER', active: true, dealerId: { in: dealerIds } },
    select: { id: true, email: true, notificationEmail: true, dealerId: true },
  });
  const map = new Map<string, { id: string; email: string }[]>();
  for (const u of users) {
    if (!u.dealerId) continue;
    const email = (u.notificationEmail || u.email || '').trim();
    if (!email) continue;
    const arr = map.get(u.dealerId) ?? [];
    arr.push({ id: u.id, email });
    map.set(u.dealerId, arr);
  }
  return map;
}

/** Expiry reminders at 30/15/10/3 days (and once expired). */
async function runExpiryReminders(now: Date): Promise<{ reminded: number; emails: number }> {
  const windowEnd = new Date(now.getTime() + 31 * 86_400_000);
  const candidates = await prisma.homeDepotIdTag.findMany({
    where: {
      status: { in: ['ACTIVE', 'TAG_ISSUED'] },
      validUntil: { not: null, lte: windowEnd },
    },
    select: {
      id: true, personName: true, personEmail: true, validUntil: true, expiryRemindStage: true, dealerId: true,
      dealer: { select: { name: true } },
    },
    take: 3000,
  });
  if (candidates.length === 0) return { reminded: 0, emails: 0 };

  const dealerIds = Array.from(new Set(candidates.map((c) => c.dealerId)));
  const officeMap = await officeRecipients(dealerIds);

  let reminded = 0;
  let emails = 0;

  for (const c of candidates) {
    const daysLeft = daysUntil(c.validUntil) ?? 0;
    const threshold = dueThreshold(daysLeft, c.expiryRemindStage);
    if (threshold === null) continue;

    const office = c.dealer?.name || 'your office';
    const phrase = whenPhrase(daysLeft);
    const expiry = dateStr(c.validUntil);
    const overdue = daysLeft < 0;
    const heading = overdue ? 'A Home Depot ID badge has expired' : 'A Home Depot ID badge is expiring soon';
    const body = `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">Renew the badge through Entuitive before it lapses so this person can keep working on Home Depot jobs. Once the new card is issued, we’ll update the record and the countdown resets.</p>`;

    // Rep (while active).
    if (c.personEmail) {
      const res = await sendEmail({
        to: c.personEmail,
        subject: `${overdue ? '⚠️ ' : ''}Your Home Depot ID badge ${phrase} — Georgian Water & Air`,
        html: renderEmail({
          heading: overdue ? 'Your Home Depot ID badge has expired' : 'Your Home Depot ID badge is expiring soon',
          intro: `Your Home Depot ID badge ${phrase}${expiry ? ` (${expiry})` : ''}.`,
          bodyHtml: body,
        }),
      });
      if (res.sent) emails += 1;
    }

    // Local office.
    const recipients = officeMap.get(c.dealerId) ?? [];
    if (recipients.length) {
      const html = renderEmail({
        heading,
        intro: `${c.personName}'s Home Depot ID badge (${office}) ${phrase}${expiry ? ` (${expiry})` : ''}.`,
        bodyHtml: body,
        ctaLabel: 'Open HD ID tags',
        ctaUrl: `${appUrl()}/dealer/id-tags`,
      });
      const subject = `${overdue ? '⚠️ Expired: ' : 'Expiring: '}${c.personName}'s HD ID badge — ${office}`;
      for (const u of recipients) {
        const res = await sendEmail({ to: u.email, subject, html });
        if (res.sent) emails += 1;
        try {
          await sendPushToUser(u.id, { title: subject, body: `${c.personName} — ${phrase}`, url: '/dealer/id-tags', tag: `idtag-exp-${c.id}` });
        } catch { /* best-effort */ }
      }
    }

    await prisma.homeDepotIdTag.update({ where: { id: c.id }, data: { expiryRemindStage: threshold } });
    reminded += 1;
  }

  return { reminded, emails };
}

/** Monthly per-office roster check-up (first run of each month). */
async function runMonthlyCheckup(now: Date, tz: string): Promise<{ offices: number; emails: number }> {
  const key = monthKey(now, tz);
  const last = await getSetting(MONTHLY_KEY);
  if (last === key) return { offices: 0, emails: 0 };

  const active = await prisma.homeDepotIdTag.findMany({
    where: { status: { in: ['ACTIVE', 'TAG_ISSUED'] } },
    select: { id: true, personName: true, status: true, validUntil: true, dealerId: true, dealer: { select: { name: true } } },
    orderBy: { personName: 'asc' },
    take: 5000,
  });

  // Mark it done up-front so a second same-day run can't double-send even if the
  // sending below partially fails.
  await setSetting(MONTHLY_KEY, key);
  if (active.length === 0) return { offices: 0, emails: 0 };

  const byDealer = new Map<string, typeof active>();
  for (const a of active) {
    const arr = byDealer.get(a.dealerId) ?? [];
    arr.push(a);
    byDealer.set(a.dealerId, arr);
  }
  const officeMap = await officeRecipients(Array.from(byDealer.keys()));

  // "Expiring this month" = valid-until falls in the current calendar month.
  const monthPrefix = key; // YYYY-MM

  let offices = 0;
  let emails = 0;
  for (const [dealerId, people] of byDealer) {
    const recipients = officeMap.get(dealerId) ?? [];
    if (!recipients.length) continue;
    const office = people[0]?.dealer?.name || 'your office';

    const rowsHtml = people.map((p) => {
      const d = daysUntil(p.validUntil);
      const expiry = dateStr(p.validUntil);
      const expiringThisMonth = p.validUntil ? new Date(p.validUntil).toISOString().slice(0, 7) === monthPrefix : false;
      const color = d !== null && d < 0 ? '#b91c1c' : expiringThisMonth ? '#b45309' : '#374151';
      const note = p.validUntil ? (expiringThisMonth ? `${expiry} · this month` : expiry) : '—';
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f2;font-size:13px;color:#111827;">${escapeHtml(p.personName)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f2;font-size:13px;color:${color};font-weight:600;">${escapeHtml(note)}</td>
      </tr>`;
    }).join('');

    const expiringCount = people.filter((p) => p.validUntil && new Date(p.validUntil).toISOString().slice(0, 7) === monthPrefix).length;
    const body = `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">Here is ${escapeHtml(office)}'s active Home Depot roster (${people.length} ${people.length === 1 ? 'person' : 'people'}${expiringCount ? `, ${expiringCount} expiring this month` : ''}). Please confirm everyone is still active — if anyone has left, open HD ID tags and set them to <strong>Not proceeding</strong> so their badge is removed.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #eef0f2;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f8fafc;">
          <th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;">Person</th>
          <th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;">Valid until</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;

    const html = renderEmail({
      heading: 'Monthly Home Depot ID tag check-up',
      intro: `Please confirm who's still active at ${office}.`,
      bodyHtml: body,
      ctaLabel: 'Review the roster',
      ctaUrl: `${appUrl()}/dealer/id-tags`,
    });
    const subject = `Monthly HD ID tag check-up — ${office}`;
    let sentAny = false;
    for (const u of recipients) {
      const res = await sendEmail({ to: u.email, subject, html });
      if (res.sent) { emails += 1; sentAny = true; }
    }
    if (sentAny) offices += 1;
  }

  return { offices, emails };
}

/** Full Phase-3 sweep: expiry reminders + (first-of-month) roster check-up. */
export async function runIdTagReminders(now: Date = new Date()): Promise<IdTagReminderRunResult> {
  const cfg = await getIdTagReminderConfig();
  if (!cfg.enabled) return { ran: false, reason: 'id-tag reminders are turned off', reminded: 0, emails: 0, monthlyOffices: 0 };

  const hour = currentHourInTz(now, cfg.timezone);
  if (hour < cfg.quietStartHour || hour >= cfg.quietEndHour) {
    return { ran: false, reason: 'outside sending hours', reminded: 0, emails: 0, monthlyOffices: 0 };
  }

  const expiry = await runExpiryReminders(now);
  const monthly = await runMonthlyCheckup(now, cfg.timezone);
  return { ran: true, reminded: expiry.reminded, emails: expiry.emails + monthly.emails, monthlyOffices: monthly.offices };
}

import type { Application, ApplicationStatus, Dealer } from '@prisma/client';
import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { sendPushToUser } from './push';
import { currentHourInTz } from './sla';
import { getSetting, setSetting } from './settings';

/**
 * Escalating "your deal is still waiting on you" reminders for the DEALER.
 *
 * When a deal sits in the dealer's court — approved and waiting for the funding
 * paperwork, conditionally approved and waiting for documents, or flagged with a
 * problem — the dealer gets a nudge by email and push on a stepped-down cadence:
 *
 *   • First 24 hours  — nothing (grace period; give them the day).
 *   • Day 1           — twice: once in the morning, once in the afternoon (~3pm).
 *   • Day 2           — once (morning).
 *   • Days 3–5        — every other day (day 3 and day 5), once each (morning).
 *   • After 5 days    — twice a week, and each one is a PRIORITY message.
 *
 * Every message says what the deal is actually waiting for (the problem note,
 * or "waiting on your funding paperwork"). Reminders only send between 8am and
 * 9pm, and never more than twice in one day. The whole schedule is an
 * admin-editable rule set (Admin → Reminders) — these values are the defaults.
 *
 * The engine is driven by a scheduler that calls runDealerReminders() every
 * ~15–30 minutes (see /api/cron/dealer-reminders). Off-hours runs simply no-op.
 */

export interface ReminderConfig {
  enabled: boolean;
  timezone: string;
  quietStartHour: number; // don't send before this hour (local)
  quietEndHour: number; // don't send at/after this hour (local)
  morningHour: number; // the daily/morning send fires at/after this hour
  afternoonHour: number; // the day-1 second send fires at/after this hour
  graceHours: number; // wait this long before the first reminder
  maxPerDay: number; // hard cap on sends per deal per calendar day
  everyOtherUntilDay: number; // last day of the every-other-day ramp phase
  priorityAfterDay: number; // sends after this many days are flagged priority
  twiceWeeklyGapHours: number; // min gap between the twice-a-week tail sends
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  enabled: true,
  timezone: 'America/Toronto',
  quietStartHour: 8, // 8:00 am
  quietEndHour: 21, // up to 9:00 pm
  morningHour: 8,
  afternoonHour: 15, // ~3:00 pm
  graceHours: 24, // a day later
  maxPerDay: 2,
  everyOtherUntilDay: 5,
  priorityAfterDay: 5,
  twiceWeeklyGapHours: 84, // ~3.5 days → about twice a week
};

const SETTING_KEY = 'reminders.dealerIdle';

/** Read the stored rule set, merged over the defaults (so new knobs are safe). */
export async function getReminderConfig(): Promise<ReminderConfig> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return { ...DEFAULT_REMINDER_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderConfig>;
    return { ...DEFAULT_REMINDER_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_REMINDER_CONFIG };
  }
}

/** Persist an updated rule set (merged over what's stored). */
export async function setReminderConfig(patch: Partial<ReminderConfig>): Promise<ReminderConfig> {
  const current = await getReminderConfig();
  const next = { ...current, ...patch };
  await setSetting(SETTING_KEY, JSON.stringify(next));
  return next;
}

// ---------------------------------------------------------------------------
// Which deals count as "waiting on the dealer"
// ---------------------------------------------------------------------------

// Statuses where the ball is squarely in the dealer's court.
const DEALER_COURT: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'PROBLEM'];

export function awaitingDealer(app: Pick<Application, 'status'>): boolean {
  return DEALER_COURT.includes(app.status);
}

/** When the deal last landed in the dealer's court (start of the waiting clock). */
export function awaitingSince(
  app: Pick<Application, 'lastReviewerActionAt' | 'updatedAt' | 'createdAt'>,
): Date {
  return app.lastReviewerActionAt ?? app.updatedAt ?? app.createdAt;
}

// ---------------------------------------------------------------------------
// The cadence decision — pure and unit-tested
// ---------------------------------------------------------------------------

export interface ReminderDecision {
  due: boolean;
  priority: boolean;
  phase: 'none' | 'ramp' | 'weekly';
  reason: string; // why this decision was made (for logs/tests)
  dayNumber: number;
}

/**
 * Decide whether a reminder should fire for one deal right now, given how long
 * it's been waiting, how many reminders already went out today, and when the
 * last one was. Pure: no I/O, so it can be exhaustively tested.
 */
export function reminderDecision(args: {
  now: Date;
  awaitingSince: Date;
  lastReminderAt: Date | null;
  sentToday: number;
  cfg?: ReminderConfig;
}): ReminderDecision {
  const cfg = args.cfg ?? DEFAULT_REMINDER_CONFIG;
  const { now, awaitingSince: since, lastReminderAt, sentToday } = args;

  const ageHours = (now.getTime() - since.getTime()) / 3_600_000;
  const dayNumber = Math.max(0, Math.floor(ageHours / 24));
  const no = (reason: string, phase: ReminderDecision['phase'] = 'none'): ReminderDecision => ({
    due: false,
    priority: false,
    phase,
    reason,
    dayNumber,
  });

  if (!cfg.enabled) return no('disabled');

  const hour = currentHourInTz(now, cfg.timezone);
  if (hour < cfg.quietStartHour || hour >= cfg.quietEndHour) return no('quiet-hours');

  if (ageHours < cfg.graceHours) return no('grace');

  // Absolute safety cap regardless of phase.
  if (sentToday >= cfg.maxPerDay) return no('daily-cap');

  const priority = dayNumber > cfg.priorityAfterDay;

  if (dayNumber <= cfg.everyOtherUntilDay) {
    // Ramp phase: day 1 (x2), day 2 (x1), then every other day (3, 5, …).
    const isSendDay = dayNumber === 1 || dayNumber === 2 || (dayNumber >= 3 && (dayNumber - 1) % 2 === 0);
    if (!isSendDay) return no('not-send-day', 'ramp');

    const allowedToday = dayNumber === 1 ? 2 : 1;
    if (sentToday >= allowedToday) return no('already-sent-today', 'ramp');

    if (sentToday === 0) {
      if (hour < cfg.morningHour) return no('before-morning', 'ramp');
      return { due: true, priority, phase: 'ramp', reason: 'morning', dayNumber };
    }
    // Only day 1 (allowedToday === 2) reaches here — the afternoon send.
    if (hour < cfg.afternoonHour) return no('before-afternoon', 'ramp');
    return { due: true, priority, phase: 'ramp', reason: 'afternoon', dayNumber };
  }

  // Twice-a-week tail: one send per day, gated by a minimum gap since the last.
  if (sentToday >= 1) return no('already-sent-today', 'weekly');
  if (hour < cfg.morningHour) return no('before-morning', 'weekly');
  const gapHours = lastReminderAt ? (now.getTime() - lastReminderAt.getTime()) / 3_600_000 : Infinity;
  if (gapHours < cfg.twiceWeeklyGapHours) return no('within-weekly-gap', 'weekly');
  return { due: true, priority: true, phase: 'weekly', reason: 'twice-weekly', dayNumber };
}

// ---------------------------------------------------------------------------
// The "what you're waiting for" blurb
// ---------------------------------------------------------------------------

type ReminderDeal = Application & {
  dealer: Dealer;
  verificationChecks: { note: string | null }[];
  dealNotes: { body: string; internal: boolean }[];
};

function trim(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** A short, dealer-facing sentence describing what the deal is waiting for. */
export function reminderReason(app: ReminderDeal): string {
  if (app.status === 'PROBLEM') {
    const checkNote = app.verificationChecks.find((c) => c.note && c.note.trim())?.note;
    const dealerNote = app.dealNotes.find((n) => !n.internal && n.body.trim())?.body;
    const note = checkNote || dealerNote;
    return note
      ? `A problem needs fixing: ${trim(note)}`
      : 'A problem on this deal needs your attention before it can move forward.';
  }
  if (app.status === 'CONDITIONAL') {
    return 'Conditionally approved — waiting on the additional documents that were requested.';
  }
  // APPROVED
  return 'Approved — waiting on your funding paperwork (signed contract, void cheque or PAP, install photos, signed HD documents, and ID).';
}

// A short, low-sensitivity deal label: first name + last initial (e.g. "John D.").
function dealLabel(app: Pick<Application, 'applicantFirstName' | 'applicantLastName'>): string {
  const first = (app.applicantFirstName || '').trim();
  const lastInitial = (app.applicantLastName || '').trim().charAt(0);
  const label = `${first}${lastInitial ? ` ${lastInitial}.` : ''}`.trim();
  return label || 'a deal';
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

// Whole-day key in the config timezone, so "sent today" respects local midnight.
function tzDayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export interface ReminderRunResult {
  ran: boolean;
  reason?: string;
  deals: number; // deals that got a reminder
  emails: number;
  pushes: number;
}

/**
 * Find every deal waiting on its dealer, decide per the cadence, and send the
 * due reminders (email + push) to that dealer's users. Best-effort: a send
 * failure never throws out of the run. Returns a summary for the cron/admin UI.
 */
export async function runDealerReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const cfg = await getReminderConfig();
  if (!cfg.enabled) return { ran: false, reason: 'reminders are turned off', deals: 0, emails: 0, pushes: 0 };

  const hour = currentHourInTz(now, cfg.timezone);
  if (hour < cfg.quietStartHour || hour >= cfg.quietEndHour) {
    return { ran: false, reason: 'outside sending hours', deals: 0, emails: 0, pushes: 0 };
  }

  const graceCutoff = new Date(now.getTime() - cfg.graceHours * 3_600_000);

  // Candidate deals: in the dealer's court and past the grace period.
  const candidates = (await prisma.application.findMany({
    where: {
      status: { in: DEALER_COURT },
      OR: [
        { lastReviewerActionAt: { lte: graceCutoff } },
        { lastReviewerActionAt: null, updatedAt: { lte: graceCutoff } },
      ],
    },
    include: {
      dealer: true,
      verificationChecks: { where: { status: 'PROBLEM' }, orderBy: { updatedAt: 'desc' }, take: 1 },
      dealNotes: { where: { internal: false }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    take: 1000,
  })) as ReminderDeal[];

  if (candidates.length === 0) {
    return { ran: true, reason: 'no deals waiting on a dealer', deals: 0, emails: 0, pushes: 0 };
  }

  // Recent reminder history for these deals (enough to cover the weekly gap).
  const historyCutoff = new Date(now.getTime() - Math.max(cfg.twiceWeeklyGapHours + 24, 8 * 24) * 3_600_000);
  const history = await prisma.dealerReminder.findMany({
    where: { applicationId: { in: candidates.map((d) => d.id) }, sentAt: { gte: historyCutoff } },
    select: { applicationId: true, sentAt: true },
  });
  const byDeal = new Map<string, Date[]>();
  for (const h of history) {
    const arr = byDeal.get(h.applicationId) ?? [];
    arr.push(h.sentAt);
    byDeal.set(h.applicationId, arr);
  }
  const todayKey = tzDayKey(now, cfg.timezone);

  // Dealer recipients, grouped by dealer, fetched once.
  const dealerIds = Array.from(new Set(candidates.map((d) => d.dealerId)));
  const recipients = await prisma.user.findMany({
    where: {
      role: 'DEALER_USER',
      active: true,
      notifyIdleReminders: true,
      dealerId: { in: dealerIds },
    },
    select: { id: true, email: true, notificationEmail: true, dealerId: true },
  });
  const recipientsByDealer = new Map<string, typeof recipients>();
  for (const u of recipients) {
    if (!u.dealerId) continue;
    const arr = recipientsByDealer.get(u.dealerId) ?? [];
    arr.push(u);
    recipientsByDealer.set(u.dealerId, arr);
  }

  let dealsReminded = 0;
  let emails = 0;
  let pushes = 0;

  for (const deal of candidates) {
    const sends = byDeal.get(deal.id) ?? [];
    const sentToday = sends.filter((d) => tzDayKey(d, cfg.timezone) === todayKey).length;
    const lastReminderAt = sends.length ? new Date(Math.max(...sends.map((d) => d.getTime()))) : null;

    const decision = reminderDecision({
      now,
      awaitingSince: awaitingSince(deal),
      lastReminderAt,
      sentToday,
      cfg,
    });
    if (!decision.due) continue;

    const dealerUsers = recipientsByDealer.get(deal.dealerId) ?? [];
    if (dealerUsers.length === 0) continue; // nobody to notify

    const reason = reminderReason(deal);
    const label = dealLabel(deal);
    const dealUrl = `${appUrl()}/dealer/applications/${deal.id}`;
    const prefix = decision.priority ? '⚠️ Priority — ' : '';
    const subject = `${prefix}Action needed on ${label}`;
    const html = renderEmail({
      heading: decision.priority ? 'Priority: a deal is still waiting on you' : 'A deal is waiting on you',
      intro: `Your deal for ${label} (${deal.dealer.name}) needs something from you.`,
      bodyHtml: `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;"><strong>What's needed:</strong> ${reason
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`,
      ctaLabel: 'Open the deal',
      ctaUrl: dealUrl,
    });

    let emailedCount = 0;
    let pushedCount = 0;
    for (const u of dealerUsers) {
      const res = await sendEmail({ to: u.notificationEmail || u.email, subject, html });
      if (res.sent) emailedCount += 1;
      try {
        await sendPushToUser(u.id, {
          title: subject,
          body: `${label} — ${trim(reason, 120)}`,
          url: `/dealer/applications/${deal.id}`,
          tag: `reminder-${deal.id}`,
        });
        pushedCount += 1;
      } catch {
        /* best-effort */
      }
    }

    await prisma.dealerReminder.create({
      data: {
        applicationId: deal.id,
        dayNumber: decision.dayNumber,
        phase: decision.phase,
        priority: decision.priority,
        reason,
        emailedCount,
        pushedCount,
      },
    });

    dealsReminded += 1;
    emails += emailedCount;
    pushes += pushedCount;
  }

  return { ran: true, deals: dealsReminded, emails, pushes };
}

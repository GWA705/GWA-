import 'server-only';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { buildDealerDigest, type DigestPeriod } from './dealerDigest';
import { renderDigestBodyHtml } from './dealerDigestEmail';
import { getDealerReportBrand } from './dealerBrand';
import { weekWindow, monthWindow } from './fundingReport';

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

/** Stable key for one office+period, for dedupe (e.g. 'week:2026-09-07'). */
export function periodKeyFor(period: DigestPeriod, offset: number): string {
  const win = period === 'week' ? weekWindow(offset) : monthWindow(offset);
  const s = win.start;
  const key = period === 'week' ? s.toISOString().slice(0, 10) : `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
  return `${period}:${key}`;
}

/** Report users at an office = anyone whose office has reports on, or who holds
 * the per-user reports grant. Returns unique deliverable email addresses. */
async function officeRecipients(dealerId: string): Promise<string[]> {
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { reportsEnabled: true } });
  const users = await prisma.user.findMany({
    where: { dealerId, active: true, role: 'DEALER_USER' },
    select: { email: true, notificationEmail: true, canViewReports: true },
  });
  const emails = users
    .filter((u) => dealer?.reportsEnabled || u.canViewReports)
    .map((u) => (u.notificationEmail || u.email || '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}

export interface DigestSendResult {
  dealerId: string;
  recipients: number;
  sent: number;
  skipped?: string;
}

/**
 * Build and email one office's digest. Pass `testTo` to send only to that
 * address (admin preview); otherwise it goes to every report user at the office.
 */
export async function sendDealerDigest(
  dealerId: string,
  period: DigestPeriod,
  opts: { offset?: number; testTo?: string } = {},
): Promise<DigestSendResult> {
  const offset = opts.offset ?? -1; // default: the just-finished period
  const recipients = opts.testTo ? [opts.testTo.trim().toLowerCase()].filter(Boolean) : await officeRecipients(dealerId);
  if (recipients.length === 0) return { dealerId, recipients: 0, sent: 0, skipped: 'no recipients' };

  const [digest, brand] = await Promise.all([buildDealerDigest(dealerId, period, offset), getDealerReportBrand(dealerId)]);
  const label = period === 'week' ? 'Weekly' : 'Monthly';
  const html = renderEmail({
    heading: `${label} snapshot — ${digest.periodLabel}`,
    intro: `Here’s how ${digest.office} did over the ${period === 'week' ? 'week' : 'month'}.${opts.testTo ? ' (This is a test preview.)' : ''}`,
    bodyHtml: renderDigestBodyHtml(digest),
    ctaLabel: 'Open the full report',
    ctaUrl: `${appUrl()}/dealer/reports/digest?p=${period}`,
  });
  const subject = `${brand.name} — ${label.toLowerCase()} snapshot (${digest.periodLabel})`;

  let sent = 0;
  for (const to of recipients) {
    const res = await sendEmail({ to, subject, html });
    if (res.sent) sent += 1;
  }
  return { dealerId, recipients: recipients.length, sent };
}

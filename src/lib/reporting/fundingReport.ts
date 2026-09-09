import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from '../db';
import { sendEmail } from '../email';
import { renderEmail } from '../email-templates';

/**
 * Funding report (portal data). "Funded this week" = deals whose status became
 * FUNDED within a date window — including the ones auto-funded from a Home Depot
 * remittance. Grouped by office (dealer), with a pipeline figure for what's
 * approved but not yet funded. All internal (staff) — dealers never see this.
 */

export interface FundingReportRow {
  applicationId: string;
  customer: string;
  dealerName: string;
  fundedAt: string; // ISO datetime
  amount: number; // approvedAmount ?? requestedAmount
  currentStatus: ApplicationStatus; // flags a deal funded then later withdrawn
  hdReference: string | null;
}

export interface FundingReportOffice {
  dealerId: string;
  dealerName: string;
  count: number;
  total: number;
  deals: FundingReportRow[];
}

export interface FundingReport {
  start: string;
  end: string;
  label: string;
  count: number;
  total: number;
  offices: FundingReportOffice[];
  pipeline: { count: number; total: number }; // approved, not yet funded
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Monday 00:00 → next Monday 00:00 for the week `offsetWeeks` from the current one. */
export function weekWindow(offsetWeeks = 0, now: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sun
  const monday = addDays(d, day === 0 ? -6 : 1 - day);
  monday.setHours(0, 0, 0, 0);
  const start = addDays(monday, offsetWeeks * 7);
  const end = addDays(start, 7);
  return { start, end };
}

const PIPELINE: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'];

const monthDay = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export async function buildFundingReport(win: { start: Date; end: Date }): Promise<FundingReport> {
  const events = await prisma.statusEvent.findMany({
    where: { to: 'FUNDED', createdAt: { gte: win.start, lt: win.end } },
    orderBy: { createdAt: 'desc' },
    include: {
      application: {
        select: {
          id: true, applicantFirstName: true, applicantLastName: true, status: true,
          approvedAmount: true, requestedAmount: true, hdReference: true,
          dealer: { select: { id: true, name: true } },
        },
      },
    },
  });

  // One row per deal (latest FUNDED event in the window).
  const seen = new Set<string>();
  const rows: FundingReportRow[] = [];
  for (const e of events) {
    const a = e.application;
    if (!a || seen.has(a.id)) continue;
    seen.add(a.id);
    const amount = Number(a.approvedAmount ?? a.requestedAmount ?? 0);
    rows.push({
      applicationId: a.id,
      customer: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
      dealerName: a.dealer.name,
      fundedAt: e.createdAt.toISOString(),
      amount,
      currentStatus: a.status,
      hdReference: a.hdReference,
    });
  }

  const byDealer = new Map<string, FundingReportOffice>();
  for (const r of rows) {
    const key = r.dealerName;
    const office = byDealer.get(key) ?? { dealerId: key, dealerName: r.dealerName, count: 0, total: 0, deals: [] };
    office.count += 1;
    office.total += r.amount;
    office.deals.push(r);
    byDealer.set(key, office);
  }
  const offices = Array.from(byDealer.values()).sort((a, b) => b.total - a.total);

  // Pipeline: currently approved-but-not-funded.
  const pipeline = await prisma.application.aggregate({
    where: { status: { in: PIPELINE } },
    _count: { _all: true },
    _sum: { approvedAmount: true },
  });

  return {
    start: win.start.toISOString(),
    end: win.end.toISOString(),
    label: `${monthDay(win.start)} – ${monthDay(addDays(win.end, -1))}`,
    count: rows.length,
    total: rows.reduce((s, r) => s + r.amount, 0),
    offices,
    pipeline: { count: pipeline._count._all, total: Number(pipeline._sum.approvedAmount ?? 0) },
  };
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

export interface WeeklyFundingResult {
  ran: boolean;
  week: string;
  deals: number;
  emailed: number;
}

/**
 * Build LAST week's funding report and email it to active admins. Internal —
 * carries dollar figures, so it goes to admins only, never dealers. Best-effort.
 */
export async function sendWeeklyFundingReport(now: Date = new Date()): Promise<WeeklyFundingResult> {
  const win = weekWindow(-1, now);
  const report = await buildFundingReport(win);

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { email: true, notificationEmail: true },
  });
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;
  const officeRows = report.offices
    .map((o) => `<tr><td style="padding:4px 10px;border-bottom:1px solid #eee">${o.dealerName}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right">${o.count}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right">${money(o.total)}</td></tr>`)
    .join('');
  const bodyHtml =
    `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>${report.count}</strong> deals funded last week (${report.label}), totalling <strong>${money(report.total)}</strong> in approved value. ${report.pipeline.count} deals are approved and awaiting funding.</p>` +
    (officeRows
      ? `<table style="border-collapse:collapse;font-size:13px;margin:0 0 12px"><thead><tr><th style="padding:4px 10px;text-align:left;color:#6b7280">Office</th><th style="padding:4px 10px;text-align:right;color:#6b7280">Deals</th><th style="padding:4px 10px;text-align:right;color:#6b7280">Value</th></tr></thead><tbody>${officeRows}</tbody></table>`
      : '<p style="font-size:13px;color:#6b7280">No deals were funded last week.</p>');

  let emailed = 0;
  for (const u of admins) {
    const res = await sendEmail({
      to: u.notificationEmail || u.email,
      subject: `Weekly funding report — ${report.label} — ${money(report.total)}`,
      html: renderEmail({
        heading: 'Weekly funding report',
        intro: `Deals funded last week (${report.label}).`,
        bodyHtml,
        ctaLabel: 'Open the funding report',
        ctaUrl: `${appUrl()}/staff/reports/funding?w=-1`,
      }),
    });
    if (res.sent) emailed += 1;
  }

  return { ran: true, week: report.label, deals: report.count, emailed };
}

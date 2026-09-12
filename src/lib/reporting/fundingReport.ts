import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from '../db';
import { sendEmail } from '../email';
import { renderEmail } from '../email-templates';

/**
 * Funding report (portal data) — PAID deals only.
 *
 * A deal counts when it has actually been PAID: a Payout record (the dealer
 * payout receipt, incl. the ones auto-filled from a Home Depot remittance /
 * journal "Pay to dealer") whose `paidOn` falls in the window. The dollar figure
 * is the ACTUAL amount paid to the dealer, not the approved amount. Split
 * payments are summed per deal within the window.
 *
 * Windowed by WEEK or MONTH. Grouped by office (dealer), with a pipeline figure
 * for deals funded/approved but not yet paid. Can be scoped to one office
 * (`opts.dealerId`) for the dealer-facing version; unscoped is the admin view.
 */

export interface FundingReportRow {
  applicationId: string;
  customer: string;
  dealerName: string;
  paidOn: string; // ISO datetime of the latest payout in the window
  amount: number; // actual $ paid to the dealer in the window (summed for splits)
  currentStatus: ApplicationStatus;
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
  pipeline: { count: number; total: number }; // funded/approved, not yet paid
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

/** 1st 00:00 → next 1st 00:00 for the month `offsetMonths` from the current one. */
export function monthWindow(offsetMonths = 0, now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

// Funded/approved but not yet paid — the "awaiting payment" pipeline.
const PIPELINE: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];

const monthDay = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export async function buildFundingReport(
  win: { start: Date; end: Date },
  opts: { dealerId?: string } = {},
): Promise<FundingReport> {
  const payouts = await prisma.payout.findMany({
    where: {
      paidOn: { gte: win.start, lt: win.end },
      ...(opts.dealerId ? { application: { dealerId: opts.dealerId } } : {}),
    },
    orderBy: { paidOn: 'desc' },
    include: {
      application: {
        select: {
          id: true, applicantFirstName: true, applicantLastName: true, status: true,
          hdReference: true, dealer: { select: { id: true, name: true } },
        },
      },
    },
  });

  // One row per deal in the window: sum the payout amounts (splits), keep the
  // latest paid date.
  const byDeal = new Map<string, FundingReportRow>();
  for (const p of payouts) {
    const a = p.application;
    if (!a) continue;
    const amt = Number(p.amount) || 0;
    const existing = byDeal.get(a.id);
    if (existing) {
      existing.amount += amt;
      if (p.paidOn.toISOString() > existing.paidOn) existing.paidOn = p.paidOn.toISOString();
    } else {
      byDeal.set(a.id, {
        applicationId: a.id,
        customer: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
        dealerName: a.dealer.name,
        paidOn: p.paidOn.toISOString(),
        amount: amt,
        currentStatus: a.status,
        hdReference: a.hdReference,
      });
    }
  }
  const rows = Array.from(byDeal.values());

  const byDealer = new Map<string, FundingReportOffice>();
  for (const r of rows) {
    const office = byDealer.get(r.dealerName) ?? { dealerId: r.dealerName, dealerName: r.dealerName, count: 0, total: 0, deals: [] };
    office.count += 1;
    office.total += r.amount;
    office.deals.push(r);
    byDealer.set(r.dealerName, office);
  }
  for (const o of byDealer.values()) o.deals.sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const offices = Array.from(byDealer.values()).sort((a, b) => b.total - a.total);

  // Pipeline: funded/approved but not yet paid (no payout on record).
  const pipeline = await prisma.application.aggregate({
    where: {
      status: { in: PIPELINE },
      payouts: { none: {} },
      ...(opts.dealerId ? { dealerId: opts.dealerId } : {}),
    },
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
 * Build LAST week's funding report (paid deals) and email it to active admins.
 * Internal — carries dollar figures, so admins only, never dealers. Best-effort.
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
    `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>${report.count}</strong> deals paid last week (${report.label}), totalling <strong>${money(report.total)}</strong> paid to dealers. ${report.pipeline.count} deals are funded/approved and awaiting payment.</p>` +
    (officeRows
      ? `<table style="border-collapse:collapse;font-size:13px;margin:0 0 12px"><thead><tr><th style="padding:4px 10px;text-align:left;color:#6b7280">Office</th><th style="padding:4px 10px;text-align:right;color:#6b7280">Deals</th><th style="padding:4px 10px;text-align:right;color:#6b7280">Paid</th></tr></thead><tbody>${officeRows}</tbody></table>`
      : '<p style="font-size:13px;color:#6b7280">No deals were paid last week.</p>');

  let emailed = 0;
  for (const u of admins) {
    const res = await sendEmail({
      to: u.notificationEmail || u.email,
      subject: `Weekly funding report — ${report.label} — ${money(report.total)} paid`,
      html: renderEmail({
        heading: 'Weekly funding report',
        intro: `Deals paid last week (${report.label}).`,
        bodyHtml,
        ctaLabel: 'Open the funding report',
        ctaUrl: `${appUrl()}/staff/reports/funding?p=week&o=-1`,
      }),
    });
    if (res.sent) emailed += 1;
  }

  return { ran: true, week: report.label, deals: report.count, emailed };
}

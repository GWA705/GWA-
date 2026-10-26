'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { setSetting, getSetting } from '@/lib/settings';
import { sendEmail } from '@/lib/email';
import {
  lastFullWeek, assembleNational, renderNationalEmailHtml,
  assembleStoreReports, renderStoreEmailHtml, weeklySenderIdentity,
  sendWeeklyReports, weeklyReportsEnabled,
} from '@/lib/reporting/weeklyReports';

export interface WeeklyActionState { error?: string; ok?: boolean; summary?: string }

async function myEmail(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email || 'reporter@ghsbarrie.ca';
}

/** Flip the master on/off switch for the weekly auto-send (default off). */
export async function toggleWeeklyEnabledAction(): Promise<WeeklyActionState> {
  const session = await requireAdminSection('weekly-reports');
  const now = (await getSetting('hdReport.weeklyEnabled')) === '1';
  await setSetting('hdReport.weeklyEnabled', now ? '0' : '1');
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'Setting', entityId: 'hdReport.weeklyEnabled', detail: `Weekly auto-send ${now ? 'DISABLED' : 'ENABLED'}` });
  revalidatePath('/admin/weekly-reports');
  return { ok: true, summary: now ? 'Weekly auto-send turned OFF.' : 'Weekly auto-send turned ON.' };
}

/** Send a TEST of the national report to the signed-in user only (never the real list). */
export async function sendTestNationalAction(): Promise<WeeklyActionState> {
  const session = await requireAdminSection('weekly-reports');
  const to = await myEmail(session.userId);
  const week = lastFullWeek();
  const html = renderNationalEmailHtml(await assembleNational(week));
  const { from, replyTo } = weeklySenderIdentity();
  const res = await sendEmail({ to, subject: `[TEST] GWA National Weekly Sales — ${week.label}`, html, from, replyTo });
  if (!res.sent) return { error: res.reason === 'log-only' ? 'Email is in log-only mode here — nothing was actually sent (works on production).' : `Could not send — ${res.reason}` };
  return { ok: true, summary: `Test national report sent to ${to}.` };
}

/** Send a TEST of one store's report to the signed-in user only. */
export async function sendTestStoreAction(storeNumber: string): Promise<WeeklyActionState> {
  const session = await requireAdminSection('weekly-reports');
  const to = await myEmail(session.userId);
  const week = lastFullWeek();
  const reports = await assembleStoreReports(week);
  const r = reports.find((x) => x.storeNumber === storeNumber);
  if (!r) return { error: 'No sales for that store in the last full week.' };
  const html = renderStoreEmailHtml(r);
  const { from, replyTo } = weeklySenderIdentity();
  const res = await sendEmail({ to, subject: `[TEST] Georgian Water and Air Weekly HD Sales Update — ${r.storeName}`, html, from, replyTo });
  if (!res.sent) return { error: res.reason === 'log-only' ? 'Email is in log-only mode here — nothing was actually sent (works on production).' : `Could not send — ${res.reason}` };
  return { ok: true, summary: `Test ${r.storeName} report sent to ${to}.` };
}

/** Credit (or re-credit) the Home Depot associate for a 701 store-lead sale. */
export async function setLeadCreditAction(hdRef: string, _prev: WeeklyActionState, fd: FormData): Promise<WeeklyActionState> {
  const session = await requireAdminSection('weekly-reports');
  const ref = hdRef.replace(/\D/g, '');
  if (!ref) return { error: 'Missing lead id.' };
  const source = String(fd.get('source') || 'IN_STORE') === 'ONLINE' ? 'ONLINE' : 'IN_STORE';
  const associateName = String(fd.get('associateName') || '').trim().slice(0, 120) || null;
  if (source === 'IN_STORE' && !associateName) return { error: 'Enter the associate name, or switch the source to Online.' };
  await prisma.hdStoreLeadCredit.upsert({
    where: { hdRef: ref },
    create: { hdRef: ref, associateName, source, setById: session.userId },
    update: { associateName, source, setById: session.userId },
  });
  revalidatePath('/admin/weekly-reports/attribution');
  revalidatePath('/admin/weekly-reports');
  return { ok: true, summary: 'Saved.' };
}

/** Send this week's reports for real, now (to all recipients, BCC'd). Idempotent. */
export async function sendWeeklyNowAction(): Promise<WeeklyActionState> {
  const session = await requireAdminSection('weekly-reports');
  // The master switch gates the manual send too: nothing reaches a real Home
  // Depot recipient until it is turned on. Use the Test buttons to preview.
  if (!(await weeklyReportsEnabled())) {
    return { error: 'Weekly auto-send is OFF. Turn the master switch ON first — or use a Test button to preview without sending.' };
  }
  const week = lastFullWeek();
  const res = await sendWeeklyReports(week);
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'HdWeeklyReport', entityId: week.label, detail: `Manual weekly send — national ${res.national}, ${res.storesSent} stores, ${res.recipients} recipients${res.errors.length ? `, ${res.errors.length} errors` : ''}` });
  revalidatePath('/admin/weekly-reports');
  if (res.errors.length) return { error: `Sent with ${res.errors.length} error(s): ${res.errors.slice(0, 3).join('; ')}` };
  const parts = [`National: ${res.national}`, `${res.storesSent} stores sent`, res.storesSkipped ? `${res.storesSkipped} skipped` : '', res.storesNoRecipients ? `${res.storesNoRecipients} no recipients` : '', `${res.recipients} recipients`].filter(Boolean);
  return { ok: true, summary: parts.join(' · ') };
}

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdminSection, requireSuperAdmin, startViewAs, stopViewAs } from '@/lib/session';
import { ADMIN_SECTION_KEYS } from '@/lib/constants';
import { toTitleCase, toSentenceCase, titleOrNull, sentenceOrNull } from '@/lib/textcase';
import { hashPassword, validatePasswordStrength, generateTempPassword } from '@/lib/password';
import { audit } from '@/lib/audit';
import { runAttentionAlerts } from '@/lib/sla';
import { getReminderConfig, setReminderConfig, runDealerReminders, DEFAULT_REMINDER_CONFIG, type ReminderConfig } from '@/lib/reminders';
import { sweepNewLeads } from '@/lib/leadNotify';
import crypto from 'crypto';
import path from 'path';
import { putDocument, getDocument, deleteDocument } from '@/lib/storage';
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/constants';
import { createUserSchema, updateUserSchema, createDealerSchema, createFinanceCompanySchema, announcementSchema, contentSchema, dealerAlertSchema } from '@/lib/validation';
import { redirect } from 'next/navigation';
import { CONTENT_SECTIONS } from '@/lib/constants';
import { sendEmail, emailEnabled } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { setSetting, EMAIL_SETTING_KEYS, BANNER_SETTING_KEYS, SECURITY_SETTING_KEYS, MFA_TRUST_DAY_OPTIONS, DEFAULT_MFA_TRUST_DAYS, type MfaRequirement } from '@/lib/settings';
import { parseDealerProfileForm, readExtraContacts, type OfficeContact } from '@/lib/dealerProfile';
import type { Prisma } from '@prisma/client';
import { applyDealerLogo, applySupportContactLogo } from '@/lib/dealerLogo';
import { saveCostConfig, type CostConfig } from '@/lib/costs';
import { geocodeOSM } from '@/lib/osmGeocode';
import { wipeDeals, wipeMail } from '@/lib/goLiveReset';
import { ONBOARD_CODE_KEY } from '@/lib/onboard';
import { guustoConfigured, guustoRequest } from '@/lib/guusto';

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

// Save the email identity — the From display name, the group address emails
// come FROM, and the Reply-To group address. Stored in the DB so they can be
// changed without a redeploy. Blank fields fall back to the env defaults.
// Save the outside-cost settings — the editable Google per-1,000 rates and the
// fixed monthly bill amounts. Stored in the DB (no redeploy).
export async function saveCostsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('costs');

  const fields: (keyof CostConfig)[] = [
    'googleAutocompletePer1000',
    'googleDetailsPer1000',
    'googleFreeCredit',
    'render',
    'awsS3',
    'awsRds',
    'email',
    'domain',
  ];
  const patch: Partial<CostConfig> = {};
  for (const f of fields) {
    const raw = formData.get(f);
    if (raw == null || String(raw).trim() === '') continue;
    const n = Number(String(raw).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) return { error: `“${f}” must be a number of 0 or more.` };
    patch[f] = Math.round(n * 100) / 100;
  }
  await saveCostConfig(patch);
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'AppSetting', entityId: 'costs', detail: 'Outside-cost settings updated' });
  revalidatePath('/admin/costs');
  return { ok: true, message: 'Cost settings saved.' };
}

export async function saveEmailIdentityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('email');
  const fromName = String(formData.get('fromName') || '').trim();
  const fromEmail = String(formData.get('fromEmail') || '').trim();
  const replyTo = String(formData.get('replyTo') || '').trim();

  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (fromEmail && !emailRe.test(fromEmail)) return { error: 'Enter a valid "From" email address.' };
  if (replyTo && !emailRe.test(replyTo)) return { error: 'Enter a valid "Reply-To" email address.' };

  await setSetting(EMAIL_SETTING_KEYS.fromName, fromName);
  await setSetting(EMAIL_SETTING_KEYS.fromEmail, fromEmail);
  await setSetting(EMAIL_SETTING_KEYS.replyTo, replyTo);
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'AppSetting', entityId: 'email', detail: `Email identity updated (from=${fromEmail || 'env'}, replyTo=${replyTo || 'from'})` });
  revalidatePath('/admin/email');
  return { ok: true, message: 'Email identity saved.' };
}

// Storage health check: write a tiny test object, read it back, and delete it.
// Surfaces the real error (e.g. an S3 auth/permission failure) so document-
// upload problems can be diagnosed without digging through server logs.
export async function testStorageAction(): Promise<ActionState> {
  const session = await requireAdminSection('email');
  const key = `healthcheck/${crypto.randomBytes(8).toString('hex')}.txt`;
  const payload = Buffer.from(`storage-check ${key}`);
  try {
    await putDocument(key, payload);
    const back = await getDocument(key);
    const roundTripOk = Buffer.compare(back, payload) === 0;
    await deleteDocument(key).catch(() => {});
    if (!roundTripOk) return { error: 'Storage wrote and read a file, but the contents did not match. Check encryption settings.' };
    const driver = process.env.STORAGE_DRIVER === 's3' ? `S3 (bucket ${process.env.S3_BUCKET || '?'})` : 'local disk';
    await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'AppSetting', entityId: 'storage', detail: 'Storage health check passed' });
    return { ok: true, message: `Document storage is working (${driver}). A test file was written, read back, and deleted.` };
  } catch (err) {
    const e = err as { name?: string; Code?: string; message?: string };
    const code = e?.Code || e?.name || '';
    let hint = '';
    if (/InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|Forbidden|credential/i.test(`${code} ${e?.message}`)) {
      hint = ' → This looks like an AWS credential/permission problem. Re-check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in Render match the current key, and that the IAM user can PutObject/GetObject/DeleteObject on the bucket.';
    } else if (/NoSuchBucket|bucket/i.test(`${code} ${e?.message}`)) {
      hint = ' → Check S3_BUCKET and S3_REGION in Render.';
    }
    return { error: `Storage check failed: ${code ? code + ' — ' : ''}${e?.message || 'unknown error'}.${hint}` };
  }
}

// Send a test email to confirm SMTP is configured correctly. The admin can
// send to themselves (default) or any address. No personal data is included.
export async function sendTestEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('email');
  const to = String(formData.get('to') || '').trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { error: 'Enter a valid email address.' };
  }

  if (!emailEnabled()) {
    return {
      error:
        'Email is still in log-only mode. Set SMTP_HOST, SMTP_USER and SMTP_PASS in Render, redeploy, then try again.',
    };
  }

  const result = await sendEmail({
    to,
    subject: 'GWA Dealer Portal — test email',
    html: `<p>This is a test email from the GWA Dealer Portal.</p>
      <p>If you received this, outgoing email is configured correctly.</p>
      <p style="color:#6b7280;font-size:12px">Sent by ${session.email} · no action needed.</p>`,
    text: 'This is a test email from the GWA Dealer Portal. If you received this, outgoing email is configured correctly.',
  });

  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: session.userId, detail: `Sent test email to ${to} (${result.sent ? 'sent' : result.reason})` });

  if (result.sent) {
    return { ok: true, message: `Test email sent to ${to}. Check the inbox (and spam folder).` };
  }

  // Turn common SMTP failures into a plain-English hint.
  const raw = result.reason || 'unknown error';
  let hint = '';
  const code = result.code || '';
  if (code === 'EAUTH' || /invalid login|username and password not accepted|5\.7\.8|badcredentials/i.test(raw)) {
    hint =
      ' → Gmail rejected the sign-in. Re-check SMTP_USER is the exact mailbox you made the App Password on, and re-paste SMTP_PASS (the 16-char App Password, no spaces). A normal account password will NOT work.';
  } else if (code === 'ESOCKET' || code === 'ECONNECTION' || /wrong version number|ssl|tls/i.test(raw)) {
    hint =
      ' → Looks like a port/security mismatch. Use SMTP_PORT=587 and do NOT set SMTP_SECURE (or set it to false). Only use SMTP_SECURE=true with SMTP_PORT=465.';
  } else if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || /timed out|timeout/i.test(raw)) {
    hint = ' → Could not reach the mail server. Check SMTP_HOST (smtp.gmail.com) and SMTP_PORT (587).';
  }

  return { error: `Could not send: ${raw}${hint}` };
}

export async function createDealerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('dealers');
  const parsed = createDealerSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: 'Enter a dealer name.' };

  const dealer = await prisma.dealer.create({ data: { name: toTitleCase(parsed.data.name) } });
  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'Dealer', entityId: dealer.id, detail: dealer.name });
  revalidatePath('/admin/dealers');
  return { ok: true };
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('users');
  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    dealerId: formData.get('dealerId') || undefined,
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the fields and try again.' };
  }
  const d = parsed.data;

  if (d.role === 'DEALER_USER' && !d.dealerId) {
    return { error: 'Choose a dealer for this dealer user.' };
  }

  const pwError = validatePasswordStrength(d.password);
  if (pwError) return { error: pwError };

  const email = d.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'A user with that email already exists.' };

  // The distributor flag only applies to dealer users (owner / main contact).
  const isDistributor = d.role === 'DEALER_USER' && formData.get('isDistributor') === 'on';

  const user = await prisma.user.create({
    data: {
      email,
      name: toTitleCase(d.name),
      role: d.role,
      // Dealer users must have a dealer; reviewers/admins may optionally be
      // linked to one to also get that dealer's portal (one login, both views).
      dealerId: d.dealerId || null,
      isDistributor,
      passwordHash: await hashPassword(d.password),
      // null forces a password change at first login (the temp password is
      // treated as already expired) — see isPasswordExpired().
      passwordChangedAt: null,
    },
  });
  await audit({ actorId: session.userId, action: 'USER_CREATE', entityType: 'User', entityId: user.id, detail: `${email} (${d.role})` });
  revalidatePath('/admin/users');

  // A new admin has NO sections until granted — without this reminder they land
  // on their account page with nothing to do. Reviewers/dealers get access from
  // their role, so no note is needed.
  const adminNote =
    d.role === 'ADMIN'
      ? ' Note: this admin has no sections yet — grant their access under Admin → Manage access, or they won’t be able to open anything.'
      : '';

  // Optionally email the new user their login details.
  const sendInvite = formData.get('sendInvite') === 'on';
  if (!sendInvite) {
    return { ok: true, message: `User created. They must change the temporary password at first login. (No email sent.)${adminNote}` };
  }
  if (!emailEnabled()) {
    return { ok: true, message: `User created, but email is off (log-only) — no invite was sent. Share the temporary password securely.${adminNote}` };
  }

  const portalUrl = process.env.APP_URL || 'https://portal.ghsbarrie.ca';
  const invite = await sendEmail({
    to: email,
    subject: 'Your GWA Dealer Portal account',
    html: renderEmail({
      heading: 'Your account is ready',
      intro: `Hi ${d.name}, an account has been created for you on the GWA Dealer Portal. Use the details below to sign in — you'll be asked to set your own password the first time.`,
      bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;font-size:14px;color:#111827;">
        <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Web address</td><td style="padding:3px 0;"><a href="${portalUrl}" style="color:#1d4ed8;">${portalUrl}</a></td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Username</td><td style="padding:3px 0;font-weight:600;">${email}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Temporary password</td><td style="padding:3px 0;font-family:monospace;font-weight:600;">${escapeHtmlLite(d.password)}</td></tr>
      </table>`,
      ctaLabel: 'Sign in to the portal',
      ctaUrl: portalUrl,
      footerNote: 'For your security, you will be required to choose a new password when you first sign in. If you did not expect this account, please ignore this email.',
    }),
  });

  if (invite.sent) {
    return { ok: true, message: `User created and login details emailed to ${email}.` };
  }
  return { ok: true, message: `User created, but the invite email could not be sent (${invite.reason || 'error'}). Share the temporary password securely.` };
}

// Minimal HTML-escape for values interpolated into email bodyHtml.
function escapeHtmlLite(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Admin edits an existing user — name, email, role, dealer link, and optionally
// a new temporary password (which forces a change at next login).
export async function updateUserAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('users');
  const parsed = updateUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    dealerId: formData.get('dealerId') || undefined,
    newPassword: (formData.get('newPassword') as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the fields and try again.' };
  }
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: 'User not found.' };

  if (d.role === 'DEALER_USER' && !d.dealerId) {
    return { error: 'Choose a dealer for this dealer user.' };
  }
  // Don't let an admin lock themselves out by demoting their own account.
  if (userId === session.userId && d.role !== 'ADMIN') {
    return { error: "You can't change your own role away from Administrator." };
  }

  const email = d.email.toLowerCase().trim();
  const clash = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
  if (clash) return { error: 'Another user already has that email.' };

  const data: {
    email: string;
    name: string;
    role: typeof d.role;
    dealerId: string | null;
    isDistributor: boolean;
    canUseCalculator: boolean;
    canViewReports: boolean;
    canViewLeadershipReport: boolean;
    canSearchCustomers: boolean;
    canViewDealerSnapshot: boolean;
    canManageGiftCards: boolean;
    passwordHash?: string;
    passwordChangedAt?: Date | null;
    tokenVersion?: { increment: number };
  } = {
    email,
    name: toTitleCase(d.name),
    role: d.role,
    // Reviewers/admins may be linked to a dealer for dual portal access.
    dealerId: d.dealerId || null,
    // Distributor (owner / main contact) applies only to dealer users.
    isDistributor: d.role === 'DEALER_USER' && formData.get('isDistributor') === 'on',
    // Per-user grant for the payout calculator.
    canUseCalculator: formData.get('canUseCalculator') === 'on',
    // Per-user grant for dealer-facing reports (their own office). Dealer only.
    canViewReports: d.role === 'DEALER_USER' && formData.get('canViewReports') === 'on',
    // Per-user grant for the company-wide leadership snapshot. Internal only.
    canViewLeadershipReport: d.role !== 'DEALER_USER' && formData.get('canViewLeadershipReport') === 'on',
    // Per-user grant for the full detailed customer search. Internal only.
    canSearchCustomers: d.role !== 'DEALER_USER' && formData.get('canSearchCustomers') === 'on',
    // Per-user grant for the admin Dealer Snapshot report. Internal only.
    canViewDealerSnapshot: d.role !== 'DEALER_USER' && formData.get('canViewDealerSnapshot') === 'on',
    // Per-user grant to work the water-test gift-card queue. Internal only.
    canManageGiftCards: d.role !== 'DEALER_USER' && formData.get('canManageGiftCards') === 'on',
  };

  if (d.newPassword && d.newPassword.trim()) {
    const pwError = validatePasswordStrength(d.newPassword);
    if (pwError) return { error: pwError };
    data.passwordHash = await hashPassword(d.newPassword);
    data.passwordChangedAt = null; // force change at next login
  }

  // Revoke the target's existing sessions so a role/dealer/password change takes
  // effect immediately — but not when an admin edits their own account (that
  // would log them out mid-action).
  if (userId !== session.userId) {
    data.tokenVersion = { increment: 1 };
  }

  await prisma.user.update({ where: { id: userId }, data });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: userId, detail: `edited: ${email} (${d.role})${data.passwordHash ? ' + password reset' : ''}` });
  revalidatePath('/admin/users');
  redirect('/admin/users');
}

export async function toggleUserActiveAction(userId: string): Promise<void> {
  const session = await requireAdminSection('users');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.id === session.userId) return; // cannot disable self
  // Deactivating also revokes the user's live sessions immediately.
  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active, tokenVersion: { increment: 1 } },
  });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: userId, detail: `active=${!user.active} (${user.active ? 'archived' : 'unarchived'})` });
  revalidatePath('/admin/users');
}

/**
 * Sign a user out of every device: revoke all live sessions (tokenVersion) and
 * all remembered "trusted" 2FA devices (mfaTrustVersion), so their next request
 * lands on the login page and their next sign-in requires a fresh 2FA code.
 */
export async function signOutUserEverywhereAction(userId: string): Promise<void> {
  const session = await requireAdminSection('users');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) return;
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 }, mfaTrustVersion: { increment: 1 } },
  });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: userId, detail: 'signed out of all devices + revoked trusted 2FA devices' });
  revalidatePath('/admin/users');
}

/**
 * Permanently delete a user. Only allowed when the account has no history at all
 * — it has never created/approved a deal, uploaded/verified a document, made a
 * decision or status change, recorded a payout, written a note, run a
 * confirmation, or generated any audit-log entry. Anyone with history must be
 * archived (deactivated) instead so records and the audit trail stay intact.
 * Admins cannot delete their own account.
 */
export async function deleteUserAction(userId: string): Promise<void> {
  const session = await requireAdminSection('users');
  if (userId === session.userId) return; // cannot delete self
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          applicationsCreated: true,
          applicationsApproved: true,
          documentsUploaded: true,
          documentsVerified: true,
          decisions: true,
          statusEvents: true,
          auditLogs: true,
          payoutsRecorded: true,
          notesAuthored: true,
          confirmations: true,
        },
      },
    },
  });
  if (!user) return;
  const references = Object.values(user._count).reduce((a, b) => a + b, 0);
  if (references > 0) return; // has history — the UI offers Delete only when empty; guard here too
  // Unused password-reset tokens cascade with the user (they carry no history).
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: userId, detail: `deleted: ${user.email}` });
  revalidatePath('/admin/users');
}

export async function toggleDealerActiveAction(dealerId: string): Promise<void> {
  const session = await requireAdminSection('dealers');
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
  if (!dealer) return;
  await prisma.dealer.update({ where: { id: dealerId }, data: { active: !dealer.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Dealer', entityId: dealerId, detail: `active=${!dealer.active} (${dealer.active ? 'archived' : 'unarchived'})` });
  revalidatePath('/admin/dealers');
}

// Give / revoke the payout calculator for a whole dealership (all its users).
export async function toggleDealerCalculatorAction(dealerId: string): Promise<void> {
  const session = await requireAdminSection('dealers');
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { calculatorEnabled: true } });
  if (!dealer) return;
  await prisma.dealer.update({ where: { id: dealerId }, data: { calculatorEnabled: !dealer.calculatorEnabled } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Dealer', entityId: dealerId, detail: `calculator=${!dealer.calculatorEnabled}` });
  revalidatePath('/admin/dealers');
}

export async function toggleDealerReportsAction(dealerId: string): Promise<void> {
  const session = await requireAdminSection('dealers');
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { reportsEnabled: true } });
  if (!dealer) return;
  await prisma.dealer.update({ where: { id: dealerId }, data: { reportsEnabled: !dealer.reportsEnabled } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Dealer', entityId: dealerId, detail: `reports=${!dealer.reportsEnabled}` });
  revalidatePath('/admin/dealers');
}

/**
 * Permanently delete a dealer. Only allowed when the dealer has no users and no
 * applications — deleting one with customer applications would destroy personal
 * information and the audit trail, so those must be archived instead.
 */
export async function deleteDealerAction(dealerId: string): Promise<void> {
  const session = await requireAdminSection('dealers');
  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    include: { _count: { select: { users: true, applications: true } } },
  });
  if (!dealer) return;
  if (dealer._count.users > 0 || dealer._count.applications > 0) {
    // Not empty — refuse the hard delete. The UI only offers Delete on empty
    // dealers, but guard here too in case of a stale page.
    return;
  }
  // Home Depot stores cascade-delete with the dealer.
  await prisma.dealer.delete({ where: { id: dealerId } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Dealer', entityId: dealerId, detail: `deleted: ${dealer.name}` });
  revalidatePath('/admin/dealers');
}

export async function createFinanceCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('finance');
  const parsed = createFinanceCompanySchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: 'Enter a finance company name.' };

  const fc = await prisma.financeCompany.create({ data: { name: toTitleCase(parsed.data.name) } });
  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'FinanceCompany', entityId: fc.id, detail: fc.name });
  revalidatePath('/admin/finance-companies');
  return { ok: true };
}

export async function toggleFinanceCompanyActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('finance');
  const fc = await prisma.financeCompany.findUnique({ where: { id } });
  if (!fc) return;
  await prisma.financeCompany.update({ where: { id }, data: { active: !fc.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'FinanceCompany', entityId: id, detail: `active=${!fc.active} (${fc.active ? 'archived' : 'unarchived'})` });
  revalidatePath('/admin/finance-companies');
}

// Toggle the "require a serial number for every product" rule for this company.
export async function toggleFinanceCompanySerialAction(id: string): Promise<void> {
  const session = await requireAdminSection('finance');
  const fc = await prisma.financeCompany.findUnique({ where: { id } });
  if (!fc) return;
  await prisma.financeCompany.update({ where: { id }, data: { requiresSerialPerProduct: !fc.requiresSerialPerProduct } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'FinanceCompany', entityId: id, detail: `requiresSerialPerProduct=${!fc.requiresSerialPerProduct}` });
  revalidatePath('/admin/finance-companies');
}

/**
 * Permanently delete a finance company. Only allowed when no deals reference it
 * — one that has been used on any application must be archived instead so the
 * historical record stays intact.
 */
export async function deleteFinanceCompanyAction(id: string): Promise<void> {
  const session = await requireAdminSection('finance');
  const fc = await prisma.financeCompany.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } },
  });
  if (!fc) return;
  if (fc._count.applications > 0) return; // used on deals — archive instead
  await prisma.financeCompany.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'FinanceCompany', entityId: id, detail: `deleted: ${fc.name}` });
  revalidatePath('/admin/finance-companies');
}

// --- Products (sales-journal dropdown, admin-managed) ----------------------

// Short journal code (e.g. "UV12"): keep it compact, allow letters/digits and a
// few separators, and store null when left blank so the full name is written.
function cleanJournalName(raw: string): string | null {
  const j = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  return j.length ? j : null;
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('products');
  const name = toTitleCase(String(formData.get('name') || '').trim());
  if (!name || name.length > 120) return { error: 'Enter a product name (up to 120 characters).' };
  const journalName = cleanJournalName(String(formData.get('journalName') || ''));
  const existing = await prisma.product.findFirst({ where: { name } });
  if (existing) return { error: 'That product already exists.' };
  // New products go to the bottom of the list.
  const last = await prisma.product.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  const p = await prisma.product.create({
    data: { name, journalName, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'Product', entityId: p.id, detail: `${p.name}${journalName ? ` (${journalName})` : ''}` });
  revalidatePath('/admin/products');
  return { ok: true };
}

// An admin sets the FINAL journal code for a dealer-added custom product (the
// dealer's auto first-letters code is just the starting suggestion).
export async function setDealerCustomProductCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('products');
  const id = String(formData.get('id') || '');
  const journalName = cleanJournalName(String(formData.get('journalName') || ''));
  const row = await prisma.dealerCustomProduct.findUnique({ where: { id } });
  if (!row) return { error: 'Product not found.' };
  await prisma.dealerCustomProduct.update({ where: { id }, data: { journalName } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'DealerCustomProduct', entityId: id, detail: `journal code: ${row.name} -> ${journalName ?? '(none)'}` });
  revalidatePath('/admin/products');
  return { ok: true, message: 'Journal code saved.' };
}

export async function deleteDealerCustomProductAction(id: string): Promise<void> {
  const session = await requireAdminSection('products');
  const row = await prisma.dealerCustomProduct.findUnique({ where: { id } });
  if (!row) return;
  await prisma.dealerCustomProduct.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'DealerCustomProduct', entityId: id, detail: `removed dealer product: ${row.name}` });
  revalidatePath('/admin/products');
}

export async function renameProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('products');
  const id = String(formData.get('id') || '');
  const name = toTitleCase(String(formData.get('name') || '').trim());
  if (!name || name.length > 120) return { error: 'Enter a product name (up to 120 characters).' };
  const journalName = cleanJournalName(String(formData.get('journalName') || ''));
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return { error: 'Product not found.' };
  await prisma.product.update({ where: { id }, data: { name, journalName } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Product', entityId: id, detail: `renamed: ${p.name} -> ${name}${journalName ? ` (${journalName})` : ''}` });
  revalidatePath('/admin/products');
  return { ok: true };
}

// Move a product up or down one place. Normalises every product's sortOrder to
// its position (0..n) and swaps the two neighbours, so the order sticks even
// when several rows were left at the default sortOrder of 0. This order drives
// both the admin list and the dealer's "Product(s) sold" picker.
export async function moveProductAction(id: string, dir: 'up' | 'down'): Promise<void> {
  const session = await requireAdminSection('products');
  const all = await prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true } });
  const i = all.findIndex((p) => p.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;
  const order = all.map((p) => p.id);
  [order[i], order[j]] = [order[j], order[i]];
  await prisma.$transaction(order.map((pid, idx) => prisma.product.update({ where: { id: pid }, data: { sortOrder: idx } })));
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Product', entityId: id, detail: `moved ${dir}` });
  revalidatePath('/admin/products');
}

export async function toggleProductActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('products');
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { active: !p.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Product', entityId: id, detail: `active=${!p.active}` });
  revalidatePath('/admin/products');
}

// Products aren't referenced by a foreign key (selections are stored as names on
// the deal), so a delete never affects historical records — it just removes the
// dropdown option.
export async function deleteProductAction(id: string): Promise<void> {
  const session = await requireAdminSection('products');
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  await prisma.product.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Product', entityId: id, detail: `deleted: ${p.name}` });
  revalidatePath('/admin/products');
}

// Save the per-slot banner slideshow toggles. When a slot is OFF, its banners
// stack instead of rotating.
export async function saveBannerSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('announcements');
  const top = formData.get('rotateTop') === 'on';
  const bottom = formData.get('rotateBottom') === 'on';
  await setSetting(BANNER_SETTING_KEYS.rotateTop, top ? 'true' : 'false');
  await setSetting(BANNER_SETTING_KEYS.rotateBottom, bottom ? 'true' : 'false');
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'AppSetting', entityId: 'banner', detail: `Banner rotation: top=${top}, bottom=${bottom}` });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
  return { ok: true, message: 'Slideshow settings saved.' };
}

// Save the two-factor-authentication requirement policy.
export async function saveSecuritySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('security');
  const raw = String(formData.get('mfaRequirement') || '');
  const value: MfaRequirement = raw === 'staff' || raw === 'off' ? raw : 'everyone';
  await setSetting(SECURITY_SETTING_KEYS.mfaRequirement, value);

  // How long a device stays trusted after a 2FA (so users aren't asked every
  // login). Clamp to the offered set; anything else → default.
  const trustRaw = parseInt(String(formData.get('mfaTrustDays') || ''), 10);
  const trustDays = (MFA_TRUST_DAY_OPTIONS as readonly number[]).includes(trustRaw) ? trustRaw : DEFAULT_MFA_TRUST_DAYS;
  await setSetting(SECURITY_SETTING_KEYS.mfaTrustDays, String(trustDays));

  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'AppSetting', entityId: 'security', detail: `MFA requirement: ${value}; trust days: ${trustDays}` });
  revalidatePath('/admin/security');
  return { ok: true, message: 'Security settings saved.' };
}

// --- Quick-note templates --------------------------------------------------

export async function createNoteTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('note-templates');
  const label = toTitleCase(String(formData.get('label') || '').trim());
  const body = toSentenceCase(String(formData.get('body') || '').trim());
  if (!label || label.length > 60) return { error: 'Enter a short label (up to 60 characters).' };
  if (!body || body.length > 1000) return { error: 'Enter the note text (up to 1000 characters).' };
  const count = await prisma.noteTemplate.count();
  const t = await prisma.noteTemplate.create({ data: { label, body, sortOrder: count } });
  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'NoteTemplate', entityId: t.id, detail: label });
  revalidatePath('/admin/note-templates');
  return { ok: true };
}

export async function updateNoteTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('note-templates');
  const id = String(formData.get('id') || '');
  const label = toTitleCase(String(formData.get('label') || '').trim());
  const body = toSentenceCase(String(formData.get('body') || '').trim());
  if (!label || label.length > 60) return { error: 'Enter a short label (up to 60 characters).' };
  if (!body || body.length > 1000) return { error: 'Enter the note text (up to 1000 characters).' };
  const t = await prisma.noteTemplate.findUnique({ where: { id } });
  if (!t) return { error: 'Template not found.' };
  await prisma.noteTemplate.update({ where: { id }, data: { label, body } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'NoteTemplate', entityId: id, detail: label });
  revalidatePath('/admin/note-templates');
  return { ok: true };
}

export async function toggleNoteTemplateActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('note-templates');
  const t = await prisma.noteTemplate.findUnique({ where: { id } });
  if (!t) return;
  await prisma.noteTemplate.update({ where: { id }, data: { active: !t.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'NoteTemplate', entityId: id, detail: `active=${!t.active}` });
  revalidatePath('/admin/note-templates');
}

export async function deleteNoteTemplateAction(id: string): Promise<void> {
  const session = await requireAdminSection('note-templates');
  const t = await prisma.noteTemplate.findUnique({ where: { id } });
  if (!t) return;
  await prisma.noteTemplate.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'NoteTemplate', entityId: id, detail: `deleted: ${t.label}` });
  revalidatePath('/admin/note-templates');
}

// --- Announcements / banner ------------------------------------------------

export async function createAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('announcements');
  const file = formData.get('image') as File | null;
  const hasImage = !!file && typeof file !== 'string' && file.size > 0;

  const parsed = announcementSchema.safeParse({
    title: (formData.get('title') as string) || undefined,
    body: (formData.get('body') as string) || undefined,
    linkUrl: (formData.get('linkUrl') as string) || undefined,
    position: (formData.get('position') as string) || undefined,
    hasImage,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;

  // Validate the image BEFORE creating the announcement, so a bad/oversized
  // image never leaves behind an empty orphan announcement.
  if (hasImage) {
    if (file!.size > MAX_FILE_BYTES) return { error: 'Image is too large (max 15 MB).' };
    if (!ALLOWED_MIME_TYPES.includes(file!.type) || !file!.type.startsWith('image/')) {
      return { error: 'Banner must be an image (JPG, PNG, WEBP).' };
    }
  }

  const created = await prisma.announcement.create({
    data: { title: titleOrNull(d.title), body: sentenceOrNull(d.body), linkUrl: d.linkUrl || null, position: d.position },
  });

  if (hasImage) {
    try {
      const ext = path.extname(file!.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
      const key = `announcements/${created.id}/${crypto.randomBytes(8).toString('hex')}${ext}`;
      const bytes = Buffer.from(await file!.arrayBuffer());
      await putDocument(key, bytes);
      await prisma.announcement.update({
        where: { id: created.id },
        data: { imageStorageKey: key, imageMime: file!.type },
      });
    } catch (err) {
      // Upload failed — remove the just-created row so nothing accumulates.
      console.error('[announcement] image upload failed; rolling back', err);
      await prisma.announcement.delete({ where: { id: created.id } }).catch(() => {});
      return { error: 'The image could not be saved. Please try again.' };
    }
  }

  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'Announcement', entityId: created.id, detail: d.title || 'announcement' });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
  return { ok: true };
}

// Replace (or remove) the image on an existing announcement, so admins can swap
// the picture without creating a new announcement each time.
export async function setAnnouncementImageAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('announcements');
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return { error: 'Announcement not found.' };

  const remove = formData.get('remove') === '1';
  const file = formData.get('image') as File | null;
  const hasImage = !!file && typeof file !== 'string' && file.size > 0;

  if (remove) {
    if (a.imageStorageKey) await deleteDocument(a.imageStorageKey).catch(() => {});
    await prisma.announcement.update({ where: { id }, data: { imageStorageKey: null, imageMime: null } });
    await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: 'image removed' });
    revalidatePath('/admin/announcements');
    revalidatePath('/dealer');
    return { ok: true };
  }

  if (!hasImage) return { error: 'Choose an image to upload.' };
  if (file!.size > MAX_FILE_BYTES) return { error: 'Image is too large (max 15 MB).' };
  if (!ALLOWED_MIME_TYPES.includes(file!.type) || !file!.type.startsWith('image/')) {
    return { error: 'Banner must be an image (JPG, PNG, WEBP).' };
  }

  try {
    const ext = path.extname(file!.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
    const key = `announcements/${id}/${crypto.randomBytes(8).toString('hex')}${ext}`;
    const bytes = Buffer.from(await file!.arrayBuffer());
    await putDocument(key, bytes);
    const oldKey = a.imageStorageKey;
    await prisma.announcement.update({ where: { id }, data: { imageStorageKey: key, imageMime: file!.type } });
    // Delete the previous image after the new one is saved (best-effort).
    if (oldKey && oldKey !== key) await deleteDocument(oldKey).catch(() => {});
  } catch (err) {
    console.error('[announcement] image replace failed', err);
    return { error: 'The image could not be saved. Please try again.' };
  }

  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: 'image replaced' });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
  return { ok: true };
}

export async function toggleAnnouncementActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('announcements');
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return;
  await prisma.announcement.update({ where: { id }, data: { active: !a.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: `active=${!a.active}` });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
}

// Flip a sign between the top of the dealer dashboard and after the deals list.
export async function toggleAnnouncementPositionAction(id: string): Promise<void> {
  const session = await requireAdminSection('announcements');
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return;
  const next = a.position === 'BOTTOM' ? 'TOP' : 'BOTTOM';
  await prisma.announcement.update({ where: { id }, data: { position: next } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: `position=${next}` });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
}

export async function deleteAnnouncementAction(id: string): Promise<void> {
  const session = await requireAdminSection('announcements');
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return;
  if (a.imageStorageKey) await deleteDocument(a.imageStorageKey).catch(() => {});
  await prisma.announcement.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: 'deleted' });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
}

// --- Content tabs (Resources / HD Promotions / HD Credit Card) -------------

function revalidateContent(section?: string) {
  revalidatePath('/admin/content');
  const match = CONTENT_SECTIONS.find((s) => s.section === section);
  if (match) revalidatePath(`/dealer/${match.slug}`);
  else CONTENT_SECTIONS.forEach((s) => revalidatePath(`/dealer/${s.slug}`));
}

// A 'YYYY-MM-DD' end date is stored as the end of that day (inclusive), so a
// promo shows through its last day and hides the next. Empty → null (no end).
function parseEndsAt(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T23:59:59`);
  return isNaN(d.getTime()) ? null : d;
}

export async function createContentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('content');
  const file = formData.get('file') as File | null;
  const hasFile = !!file && typeof file !== 'string' && file.size > 0;

  const parsed = contentSchema.safeParse({
    section: formData.get('section'),
    title: formData.get('title'),
    body: (formData.get('body') as string) || undefined,
    linkUrl: (formData.get('linkUrl') as string) || undefined,
    sortOrder: (formData.get('sortOrder') as string) || undefined,
    endsAt: (formData.get('endsAt') as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;

  const created = await prisma.contentItem.create({
    data: {
      section: d.section,
      title: toTitleCase(d.title),
      body: sentenceOrNull(d.body),
      linkUrl: d.linkUrl || null,
      sortOrder: d.sortOrder ?? 0,
      endsAt: parseEndsAt(d.endsAt),
      createdById: session.userId,
    },
  });

  if (hasFile) {
    if (file!.size > MAX_FILE_BYTES) return { error: 'File is too large (max 15 MB).' };
    if (!ALLOWED_MIME_TYPES.includes(file!.type)) {
      return { error: 'File must be a PDF or image (PDF, JPG, PNG, WEBP).' };
    }
    const ext = path.extname(file!.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const key = `content/${created.id}/${crypto.randomBytes(8).toString('hex')}${ext}`;
    const bytes = Buffer.from(await file!.arrayBuffer());
    await putDocument(key, bytes);
    await prisma.contentItem.update({
      where: { id: created.id },
      data: { fileStorageKey: key, fileMime: file!.type, fileName: file!.name.slice(0, 200) },
    });
  }

  // Optional custom cover thumbnail (image only).
  const thumb = formData.get('thumb') as File | null;
  if (thumb && typeof thumb !== 'string' && thumb.size > 0) {
    if (thumb.size > MAX_FILE_BYTES) return { error: 'Thumbnail is too large (max 15 MB).' };
    if (!thumb.type.startsWith('image/')) return { error: 'Thumbnail must be an image (JPG, PNG, WEBP).' };
    const ext = path.extname(thumb.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
    const key = `content/${created.id}/thumb-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await putDocument(key, Buffer.from(await thumb.arrayBuffer()));
    await prisma.contentItem.update({ where: { id: created.id }, data: { thumbStorageKey: key, thumbMime: thumb.type } });
  }

  await audit({ actorId: session.userId, action: 'CONTENT_CREATE', entityType: 'ContentItem', entityId: created.id, detail: `${d.section}: ${d.title}` });
  revalidateContent(d.section);
  return { ok: true };
}

export async function updateContentAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('content');
  const existing = await prisma.contentItem.findUnique({ where: { id } });
  if (!existing) return { error: 'Item not found.' };

  const parsed = contentSchema.safeParse({
    section: formData.get('section'),
    title: formData.get('title'),
    body: (formData.get('body') as string) || undefined,
    linkUrl: (formData.get('linkUrl') as string) || undefined,
    sortOrder: (formData.get('sortOrder') as string) || undefined,
    endsAt: (formData.get('endsAt') as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;

  await prisma.contentItem.update({
    where: { id },
    data: {
      section: d.section,
      title: toTitleCase(d.title),
      body: sentenceOrNull(d.body),
      linkUrl: d.linkUrl || null,
      sortOrder: d.sortOrder ?? 0,
      endsAt: parseEndsAt(d.endsAt),
    },
  });

  // Optionally replace or remove the attachment.
  const file = formData.get('file') as File | null;
  const hasNewFile = !!file && typeof file !== 'string' && file.size > 0;
  const removeFile = formData.get('removeFile') === 'on';
  if (hasNewFile) {
    if (file!.size > MAX_FILE_BYTES) return { error: 'File is too large (max 15 MB).' };
    if (!ALLOWED_MIME_TYPES.includes(file!.type)) return { error: 'File must be a PDF or image (PDF, JPG, PNG, WEBP).' };
    const ext = path.extname(file!.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const key = `content/${id}/${crypto.randomBytes(8).toString('hex')}${ext}`;
    await putDocument(key, Buffer.from(await file!.arrayBuffer()));
    if (existing.fileStorageKey) await deleteDocument(existing.fileStorageKey).catch(() => {});
    await prisma.contentItem.update({ where: { id }, data: { fileStorageKey: key, fileMime: file!.type, fileName: file!.name.slice(0, 200) } });
  } else if (removeFile && existing.fileStorageKey) {
    await deleteDocument(existing.fileStorageKey).catch(() => {});
    await prisma.contentItem.update({ where: { id }, data: { fileStorageKey: null, fileMime: null, fileName: null } });
  }

  // Optionally replace or remove the cover thumbnail (image only).
  const thumb = formData.get('thumb') as File | null;
  const hasNewThumb = !!thumb && typeof thumb !== 'string' && thumb.size > 0;
  const removeThumb = formData.get('removeThumb') === 'on';
  if (hasNewThumb) {
    if (thumb!.size > MAX_FILE_BYTES) return { error: 'Cover image is too large (max 15 MB).' };
    if (!thumb!.type.startsWith('image/')) return { error: 'Cover must be an image (JPG, PNG, WEBP).' };
    const ext = path.extname(thumb!.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
    const key = `content/${id}/thumb-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await putDocument(key, Buffer.from(await thumb!.arrayBuffer()));
    if (existing.thumbStorageKey) await deleteDocument(existing.thumbStorageKey).catch(() => {});
    await prisma.contentItem.update({ where: { id }, data: { thumbStorageKey: key, thumbMime: thumb!.type } });
  } else if (removeThumb && existing.thumbStorageKey) {
    await deleteDocument(existing.thumbStorageKey).catch(() => {});
    await prisma.contentItem.update({ where: { id }, data: { thumbStorageKey: null, thumbMime: null } });
  }

  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ContentItem', entityId: id, detail: `edited: ${d.title}` });
  revalidateContent(d.section);
  if (existing.section !== d.section) revalidateContent(existing.section); // moved between tabs
  return { ok: true };
}

export async function toggleContentActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('content');
  const c = await prisma.contentItem.findUnique({ where: { id } });
  if (!c) return;
  await prisma.contentItem.update({ where: { id }, data: { active: !c.active } });
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ContentItem', entityId: id, detail: `active=${!c.active}` });
  revalidateContent(c.section);
}

export async function deleteContentAction(id: string): Promise<void> {
  const session = await requireAdminSection('content');
  const c = await prisma.contentItem.findUnique({ where: { id } });
  if (!c) return;
  if (c.fileStorageKey) await deleteDocument(c.fileStorageKey).catch(() => {});
  if (c.thumbStorageKey) await deleteDocument(c.thumbStorageKey).catch(() => {});
  await prisma.contentItem.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ContentItem', entityId: id, detail: 'deleted' });
  revalidateContent(c.section);
}

// Set, replace, or remove a content item's custom cover thumbnail (image only).
export async function setContentThumbnailAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('content');
  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) return { error: 'Item not found.' };

  if (formData.get('remove') === '1') {
    if (item.thumbStorageKey) await deleteDocument(item.thumbStorageKey).catch(() => {});
    await prisma.contentItem.update({ where: { id }, data: { thumbStorageKey: null, thumbMime: null } });
    await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ContentItem', entityId: id, detail: 'thumbnail removed' });
    revalidateContent(item.section);
    revalidatePath('/admin/content');
    return { ok: true, message: 'Cover removed.' };
  }

  const thumb = formData.get('thumb') as File | null;
  if (!thumb || typeof thumb === 'string' || thumb.size === 0) return { error: 'Choose an image first.' };
  if (thumb.size > MAX_FILE_BYTES) return { error: 'Thumbnail is too large (max 15 MB).' };
  if (!thumb.type.startsWith('image/')) return { error: 'Thumbnail must be an image (JPG, PNG, WEBP).' };

  try {
    const ext = path.extname(thumb.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
    const key = `content/${id}/thumb-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await putDocument(key, Buffer.from(await thumb.arrayBuffer()));
    if (item.thumbStorageKey) await deleteDocument(item.thumbStorageKey).catch(() => {});
    await prisma.contentItem.update({ where: { id }, data: { thumbStorageKey: key, thumbMime: thumb.type } });
  } catch (err) {
    console.error('[content] thumbnail upload failed', err);
    return { error: 'The cover could not be saved. Please try again.' };
  }
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ContentItem', entityId: id, detail: 'thumbnail set' });
  revalidateContent(item.section);
  revalidatePath('/admin/content');
  return { ok: true, message: 'Cover updated.' };
}

// Admin: run the 2-hour "new deal not looked at" alert on demand (for testing /
// a manual nudge). Respects business hours and the 2-hour wait, same as the
// scheduled run.
export async function runAttentionAlertsNowAction(
  _prev: { ok?: boolean; message?: string },
  _formData: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  const session = await requireAdminSection('email');
  try {
    const r = await runAttentionAlerts();
    await audit({
      actorId: session.userId,
      action: 'STATUS_CHANGE',
      entityType: 'System',
      entityId: null,
      detail: `Attention-alert run: ${JSON.stringify(r)}`,
    });
    if (!r.ran) return { ok: true, message: `Not sent right now — ${r.reason} (alerts only send 8am–10pm).` };
    if (r.deals === 0) return { ok: true, message: 'Checked — no deals are waiting over 2 hours right now.' };
    return { ok: true, message: `Sent alerts for ${r.deals} deal(s) to ${r.recipients} reviewer(s).` };
  } catch (e) {
    console.error('[admin] runAttentionAlertsNow failed', e);
    return { ok: false, message: 'Could not run the alert check.' };
  }
}

// Admin: run the new-lead push sweep on demand (same work the cron does) — read
// the HD Leads Log, attribute each lead to its dealer, and push new ones once.
export async function runNewLeadsNowAction(
  _prev: { ok?: boolean; message?: string },
  _formData: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  const session = await requireAdminSection('reminders');
  try {
    const r = await sweepNewLeads();
    await audit({
      actorId: session.userId,
      action: 'STATUS_CHANGE',
      entityType: 'System',
      entityId: null,
      detail: `New-lead sweep: ${JSON.stringify(r)}`,
    });
    if (!r.configured) return { ok: false, message: 'The HD Leads Log sheet isn’t connected yet, so there are no leads to check.' };
    if (r.error) return { ok: false, message: `Couldn’t read the leads sheet: ${r.error}` };
    if (r.baselined != null) {
      return { ok: true, message: `First run — recorded ${r.baselined} existing lead(s) as a baseline. No notifications were sent; new leads from now on will push.` };
    }
    if (!r.pushed) return { ok: true, message: 'Checked — no new leads to notify right now.' };
    return { ok: true, message: `Pushed ${r.pushed} new lead(s) to their dealers.` };
  } catch (e) {
    console.error('[admin] runNewLeadsNow failed', e);
    return { ok: false, message: 'Could not run the new-lead check.' };
  }
}

// Save the dealer idle-reminder rule set. Numeric fields fall back to the
// current value when left blank/invalid; the enabled flag is a checkbox.
export async function saveReminderConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('reminders');
  const current = await getReminderConfig();

  const num = (name: keyof ReminderConfig, min: number, max: number): number => {
    const raw = String(formData.get(name) ?? '').trim();
    if (raw === '') return current[name] as number;
    const n = Number(raw);
    if (!Number.isFinite(n)) return current[name] as number;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const patch: Partial<ReminderConfig> = {
    enabled: formData.get('enabled') === 'on',
    quietStartHour: num('quietStartHour', 0, 23),
    quietEndHour: num('quietEndHour', 1, 24),
    morningHour: num('morningHour', 0, 23),
    afternoonHour: num('afternoonHour', 0, 23),
    graceHours: num('graceHours', 0, 240),
    maxPerDay: num('maxPerDay', 1, 6),
    everyOtherUntilDay: num('everyOtherUntilDay', 2, 30),
    priorityAfterDay: num('priorityAfterDay', 0, 60),
    twiceWeeklyGapHours: num('twiceWeeklyGapHours', 24, 336),
  };

  if (patch.quietEndHour! <= patch.quietStartHour!) {
    return { error: 'The end hour must be later than the start hour.' };
  }

  await setReminderConfig(patch);
  await audit({
    actorId: session.userId,
    action: 'USER_UPDATE',
    entityType: 'AppSetting',
    entityId: 'reminders',
    detail: `Dealer reminder rules updated (enabled=${patch.enabled})`,
  });
  revalidatePath('/admin/reminders');
  return { ok: true, message: 'Reminder rules saved.' };
}

// Reset the reminder rule set to the built-in defaults.
export async function resetReminderConfigAction(): Promise<void> {
  const session = await requireAdminSection('reminders');
  await setReminderConfig(DEFAULT_REMINDER_CONFIG);
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'AppSetting', entityId: 'reminders', detail: 'Dealer reminder rules reset to defaults' });
  revalidatePath('/admin/reminders');
}

// Run the dealer-reminder sweep on demand (the same work the cron does).
export async function runDealerRemindersNowAction(
  _prev: { ok?: boolean; message?: string },
  _formData: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  const session = await requireAdminSection('reminders');
  try {
    const r = await runDealerReminders();
    await audit({
      actorId: session.userId,
      action: 'STATUS_CHANGE',
      entityType: 'System',
      entityId: null,
      detail: `Dealer-reminder run: ${JSON.stringify(r)}`,
    });
    if (!r.ran) return { ok: true, message: `Not sent right now — ${r.reason}.` };
    if (r.deals === 0) return { ok: true, message: 'Checked — no dealers need a reminder right now.' };
    return { ok: true, message: `Sent reminders for ${r.deals} deal(s): ${r.emails} email(s), ${r.pushes} push(es).` };
  } catch (e) {
    console.error('[admin] runDealerRemindersNow failed', e);
    return { ok: false, message: 'Could not run the reminder check.' };
  }
}

// Admin: start "view as dealer" — see exactly what a dealer sees, to
// troubleshoot an issue. Bound to this admin's session and audit-logged.
export async function viewAsDealerAction(dealerId: string): Promise<void> {
  const session = await requireAdminSection('dealers');
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
  if (!dealer) redirect('/admin/dealers');
  await startViewAs(dealerId, session.userId);
  await audit({
    actorId: session.userId,
    action: 'USER_UPDATE',
    entityType: 'Dealer',
    entityId: dealerId,
    detail: `Started "view as dealer" (${dealer!.name})`,
  });
  redirect('/dealer');
}

// Admin: stop impersonating and return to the admin area.
export async function stopViewAsAction(): Promise<void> {
  const session = await requireAdminSection('dealers');
  stopViewAs();
  await audit({
    actorId: session.userId,
    action: 'USER_UPDATE',
    entityType: 'Dealer',
    entityId: null,
    detail: 'Stopped "view as dealer"',
  });
  redirect('/admin/dealers');
}

/**
 * Idempotent import of the acquired Home Depot stores, grouped by the dealer
 * that owns them. Creates any missing dealer and attaches any missing store
 * (matched on dealer + store number) — safe to run repeatedly. Admin only.
 */
export async function importHomeDepotStoresAction(): Promise<ActionState> {
  const session = await requireAdminSection('dealers');
  const { HD_STORE_IMPORT } = await import('@/lib/hdStores');

  let dealersCreated = 0;
  let storesCreated = 0;
  let storesUpdated = 0;

  for (const group of HD_STORE_IMPORT) {
    let dealer = await prisma.dealer.findFirst({ where: { name: group.dealer } });
    if (!dealer) {
      dealer = await prisma.dealer.create({ data: { name: group.dealer } });
      dealersCreated += 1;
    }
    for (const store of group.stores) {
      const existing = await prisma.homeDepotStore.findFirst({
        where: { dealerId: dealer.id, number: store.number },
      });
      if (!existing) {
        await prisma.homeDepotStore.create({
          data: { dealerId: dealer.id, number: store.number, name: store.city },
        });
        storesCreated += 1;
      } else if (existing.name !== store.city) {
        await prisma.homeDepotStore.update({ where: { id: existing.id }, data: { name: store.city } });
        storesUpdated += 1;
      }
    }
  }

  await audit({
    actorId: session.userId,
    action: 'DEALER_CREATE',
    entityType: 'HomeDepotStore',
    entityId: 'import',
    detail: `HD store import — ${dealersCreated} new dealers, ${storesCreated} new stores, ${storesUpdated} updated`,
  });
  revalidatePath('/admin');
  revalidatePath('/admin/dealers');

  const parts = [
    `${dealersCreated} new dealer${dealersCreated === 1 ? '' : 's'}`,
    `${storesCreated} new store${storesCreated === 1 ? '' : 's'}`,
  ];
  if (storesUpdated) parts.push(`${storesUpdated} store name${storesUpdated === 1 ? '' : 's'} updated`);
  return { ok: true, message: `Import complete — ${parts.join(', ')}. Re-running is safe (no duplicates).` };
}

// --- Dealer alerts (forced-acknowledgement pop-ups) ------------------------

export async function createDealerAlertAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('alerts');
  const parsed = dealerAlertSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    linkUrl: (formData.get('linkUrl') as string) || undefined,
    audience: (formData.get('audience') as string) || undefined,
    dealerId: (formData.get('dealerId') as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Please complete the message.' };
  }
  const d = parsed.data;
  // dealerId only matters for a dealer-specific alert.
  const dealerId = d.audience === 'DEALER' ? d.dealerId || null : null;
  if (d.audience === 'DEALER' && !dealerId) {
    return { error: 'Pick which dealer this pop-up is for.' };
  }
  const created = await prisma.dealerAlert.create({
    data: {
      title: toTitleCase(d.title),
      body: toSentenceCase(d.body),
      linkUrl: d.linkUrl?.trim() || null,
      audience: d.audience,
      dealerId,
      createdById: session.userId,
    },
  });
  await audit({
    actorId: session.userId,
    action: 'ALERT_CREATE',
    entityType: 'DealerAlert',
    entityId: created.id,
    detail: `Dealer pop-up created: ${d.title.slice(0, 80)}`,
  });
  revalidatePath('/admin/alerts');
  return { ok: true };
}

export async function toggleDealerAlertActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('alerts');
  const alert = await prisma.dealerAlert.findUnique({ where: { id } });
  if (!alert) return;
  await prisma.dealerAlert.update({ where: { id }, data: { active: !alert.active } });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'DealerAlert',
    entityId: id,
    detail: alert.active ? 'Dealer pop-up deactivated' : 'Dealer pop-up activated',
  });
  revalidatePath('/admin/alerts');
}

export async function deleteDealerAlertAction(id: string): Promise<void> {
  const session = await requireAdminSection('alerts');
  await prisma.dealerAlert.delete({ where: { id } }).catch(() => {});
  await audit({
    actorId: session.userId,
    action: 'ALERT_DELETE',
    entityType: 'DealerAlert',
    entityId: id,
    detail: 'Dealer pop-up deleted',
  });
  revalidatePath('/admin/alerts');
}

// --- Super-Admin: manage another admin's back-end access --------------------
// Only a Super Admin can grant/revoke sections and the Super-Admin flag itself.
// Guards prevent locking everyone out: you can't change your own Super-Admin
// status, and the system always keeps at least one Super Admin.
export async function saveAdminAccessAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSuperAdmin();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: 'User not found.' };
  if (target.role !== 'ADMIN') return { error: 'Only administrators have back-end access. Change the role first in Users.' };

  const wantSuper = formData.get('superAdmin') === 'on';
  // Keep only recognised section keys, in canonical order, de-duplicated.
  const picked = new Set(formData.getAll('sections').map(String));
  const sections = ADMIN_SECTION_KEYS.filter((k) => picked.has(k));

  // You can't demote yourself from Super Admin (prevents self-lockout).
  if (userId === session.userId && !wantSuper) {
    return { error: "You can't remove your own Super-Admin access." };
  }
  // Never leave the system without a Super Admin.
  if (target.superAdmin && !wantSuper) {
    const otherSupers = await prisma.user.count({
      where: { role: 'ADMIN', superAdmin: true, active: true, id: { not: userId } },
    });
    if (otherSupers === 0) {
      return { error: 'At least one Super Admin is required. Promote someone else first.' };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      superAdmin: wantSuper,
      // A Super Admin implicitly has everything; store the picked sections too so
      // that if they're later demoted, their last section grant is preserved.
      adminSections: sections,
      // Revoke the target's live sessions so the change applies immediately —
      // except when editing yourself (that would sign you out mid-action).
      ...(userId === session.userId ? {} : { tokenVersion: { increment: 1 } }),
    },
  });

  await audit({
    actorId: session.userId,
    action: 'USER_UPDATE',
    entityType: 'User',
    entityId: userId,
    detail: `admin access: ${wantSuper ? 'Super Admin' : `sections=[${sections.join(', ') || 'none'}]`}`,
  });
  revalidatePath('/admin/access');
  return { ok: true, message: `Access updated for ${target.name}.` };
}

// --- Dealer user-request approval queue ------------------------------------
// Recompute a request's rolled-up status after one of its items is decided.
async function settleUserRequest(requestId: string, reviewerId: string): Promise<void> {
  const items = await prisma.userRequestItem.findMany({ where: { requestId }, select: { status: true } });
  if (items.some((i) => i.status === 'PENDING')) return; // still open
  const anyRejected = items.some((i) => i.status === 'REJECTED');
  await prisma.userRequest.update({
    where: { id: requestId },
    data: { status: anyRejected ? 'CLOSED' : 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date() },
  });
}

/**
 * Approve one requested person → create their DEALER_USER login on the
 * requesting dealer, with a temporary password they must change at first
 * sign-in. Emails the invite when email is on; otherwise returns the temp
 * password so the admin can share it securely.
 */
export async function approveUserRequestItemAction(itemId: string): Promise<ActionState> {
  const session = await requireAdminSection('user-requests');
  const item = await prisma.userRequestItem.findUnique({ where: { id: itemId }, include: { request: true } });
  if (!item) return { error: 'Request item not found.' };
  if (item.status !== 'PENDING') return { error: 'This person has already been handled.' };

  const email = item.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Can't create a duplicate — auto-decline with a clear reason.
    await prisma.userRequestItem.update({
      where: { id: itemId },
      data: { status: 'REJECTED', rejectReason: 'A login with this email already exists.', decidedById: session.userId, decidedAt: new Date() },
    });
    await settleUserRequest(item.requestId, session.userId);
    revalidatePath('/admin/user-requests');
    return { error: `${email} already has a login — marked as declined.` };
  }

  const tempPassword = generateTempPassword();
  const created = await prisma.user.create({
    data: {
      email,
      name: toTitleCase(item.name),
      role: 'DEALER_USER',
      dealerId: item.request.dealerId,
      isDistributor: item.isMainContact,
      phone: item.phone,
      passwordHash: await hashPassword(tempPassword),
      passwordChangedAt: null, // force a change at first sign-in
    },
  });
  await prisma.userRequestItem.update({
    where: { id: itemId },
    data: { status: 'CREATED', createdUserId: created.id, decidedById: session.userId, decidedAt: new Date() },
  });
  await audit({ actorId: session.userId, action: 'USER_CREATE', entityType: 'User', entityId: created.id, detail: `${email} (DEALER_USER, from request ${item.requestId})` });
  await audit({ actorId: session.userId, action: 'USER_REQUEST_DECISION', entityType: 'UserRequestItem', entityId: itemId, detail: `approved: ${email}` });
  await settleUserRequest(item.requestId, session.userId);
  revalidatePath('/admin/user-requests');
  revalidatePath('/admin/users');

  // Email the invite when email is on; otherwise hand back the temp password.
  if (emailEnabled()) {
    const portalUrl = process.env.APP_URL || 'https://portal.ghsbarrie.ca';
    const invite = await sendEmail({
      to: email,
      subject: 'Your GWA Dealer Portal account',
      html: renderEmail({
        heading: 'Your account is ready',
        intro: `Hi ${item.name}, an account has been created for you on the GWA Dealer Portal. Use the details below to sign in — you'll be asked to set your own password the first time.`,
        bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;font-size:14px;color:#111827;">
          <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Web address</td><td style="padding:3px 0;"><a href="${portalUrl}" style="color:#1d4ed8;">${portalUrl}</a></td></tr>
          <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Username</td><td style="padding:3px 0;font-weight:600;">${email}</td></tr>
          <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">Temporary password</td><td style="padding:3px 0;font-family:monospace;font-weight:600;">${tempPassword}</td></tr>
        </table>`,
        ctaLabel: 'Sign in to the portal',
        ctaUrl: portalUrl,
        footerNote: 'For your security, you will be required to choose a new password when you first sign in.',
      }),
    });
    if (invite.sent) return { ok: true, message: `Login created and emailed to ${email}.` };
    return { ok: true, message: `Login created for ${email}, but the invite email failed. Temporary password: ${tempPassword}` };
  }
  return { ok: true, message: `Login created for ${email}. Temporary password: ${tempPassword} (share it securely — email is off).` };
}

/** Decline one requested person, with an optional reason shown back to the dealer. */
export async function rejectUserRequestItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('user-requests');
  const itemId = String(formData.get('itemId') || '');
  const reason = toSentenceCase(String(formData.get('reason') || '').trim()).slice(0, 200) || null;
  const item = await prisma.userRequestItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: 'Request item not found.' };
  if (item.status !== 'PENDING') return { error: 'This person has already been handled.' };
  await prisma.userRequestItem.update({
    where: { id: itemId },
    data: { status: 'REJECTED', rejectReason: reason, decidedById: session.userId, decidedAt: new Date() },
  });
  await audit({ actorId: session.userId, action: 'USER_REQUEST_DECISION', entityType: 'UserRequestItem', entityId: itemId, detail: `declined: ${item.email}` });
  await settleUserRequest(item.requestId, session.userId);
  revalidatePath('/admin/user-requests');
  return { ok: true };
}

// --- Office directory (admin edits any dealer's profile) --------------------
export async function saveDealerProfileAdminAction(
  dealerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSection('directory');
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { id: true } });
  if (!dealer) return { error: 'Dealer not found.' };
  const data = parseDealerProfileForm(formData);
  const extraContacts = data.extraContacts as unknown as Prisma.InputJsonValue;
  await prisma.dealerProfile.upsert({
    where: { dealerId },
    create: { dealerId, updatedById: session.userId, ...data, extraContacts },
    update: { updatedById: session.userId, ...data, extraContacts },
  });
  const logo = await applyDealerLogo(dealerId, formData);
  if (logo.error) return { error: logo.error };
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'DealerProfile', entityId: dealerId, detail: 'Office profile updated (admin)' });
  revalidatePath('/staff/directory');
  revalidatePath(`/staff/directory/${dealerId}`);
  return { ok: true };
}

// --- Support contacts (dealer Contact/Support page) -------------------------
function parseSupportContact(fd: FormData) {
  const t = (k: string, max = 200) => {
    const v = String(fd.get(k) ?? '').trim().slice(0, max);
    return v.length ? v : null;
  };
  // One or more emails, comma-separated. Normalise to a clean, lowercased,
  // comma-joined list so both the form and the directory render consistently.
  const emailRaw = String(fd.get('email') ?? '').slice(0, 320);
  const emails = emailRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return {
    name: toTitleCase(String(fd.get('name') || '').trim()).slice(0, 120),
    title: t('title', 120),
    phone: t('phone', 40),
    altPhone: t('altPhone', 40),
    email: emails.length ? emails.join(', ') : null,
    hours: t('hours', 200),
    website: t('website', 200),
    notes: t('notes', 1000),
  };
}

export async function createSupportContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('support-contacts');
  const data = parseSupportContact(formData);
  if (!data.name) return { error: 'Enter a name for the contact.' };
  const last = await prisma.supportContact.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  const c = await prisma.supportContact.create({ data: { ...data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  const logo = await applySupportContactLogo(c.id, formData);
  if (logo.error) return { error: logo.error };
  await audit({ actorId: session.userId, action: 'CONTENT_CREATE', entityType: 'SupportContact', entityId: c.id, detail: c.name });
  revalidatePath('/admin/support-contacts');
  revalidatePath('/dealer/support');
  return { ok: true };
}

export async function updateSupportContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('support-contacts');
  const id = String(formData.get('id') || '');
  const data = parseSupportContact(formData);
  if (!data.name) return { error: 'Enter a name for the contact.' };
  const existing = await prisma.supportContact.findUnique({ where: { id } });
  if (!existing) return { error: 'Contact not found.' };
  await prisma.supportContact.update({ where: { id }, data });
  const logo = await applySupportContactLogo(id, formData);
  if (logo.error) return { error: logo.error };
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'SupportContact', entityId: id, detail: data.name });
  revalidatePath('/admin/support-contacts');
  revalidatePath('/dealer/support');
  return { ok: true };
}

export async function toggleSupportContactAction(id: string): Promise<void> {
  const session = await requireAdminSection('support-contacts');
  const c = await prisma.supportContact.findUnique({ where: { id } });
  if (!c) return;
  await prisma.supportContact.update({ where: { id }, data: { active: !c.active } });
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'SupportContact', entityId: id, detail: `active=${!c.active}` });
  revalidatePath('/admin/support-contacts');
  revalidatePath('/dealer/support');
}

export async function deleteSupportContactAction(id: string): Promise<void> {
  const session = await requireAdminSection('support-contacts');
  const c = await prisma.supportContact.findUnique({ where: { id } });
  if (!c) return;
  if (c.logoStorageKey) await deleteDocument(c.logoStorageKey).catch(() => {});
  await prisma.supportContact.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'SupportContact', entityId: id, detail: `deleted: ${c.name}` });
  revalidatePath('/admin/support-contacts');
  revalidatePath('/dealer/support');
}

// ---- Store map locations (Leads map) --------------------------------------
// Managed under the "dealers" section, since HD stores belong to dealers.

interface StoreLocationResult {
  ok: boolean;
  error?: string;
  lat?: number;
  lng?: number;
}

/** Set a store's exact map location (from a dragged marker or pasted lat/lng). */
export async function setStoreLocationAction(storeId: string, lat: number, lng: number): Promise<StoreLocationResult> {
  const session = await requireAdminSection('dealers');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: 'Those coordinates don’t look right.' };
  }
  const store = await prisma.homeDepotStore.findUnique({ where: { id: storeId } });
  if (!store) return { ok: false, error: 'Store not found.' };
  await prisma.homeDepotStore.update({ where: { id: storeId }, data: { latitude: lat, longitude: lng, geocodedAt: new Date() } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'HomeDepotStore', entityId: storeId, detail: `Set store ${store.number} map location to ${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  revalidatePath('/admin/dealers/locations');
  return { ok: true, lat, lng };
}

/** Re-place a store automatically by geocoding its name. */
export async function autoGeocodeStoreAction(storeId: string): Promise<StoreLocationResult> {
  const session = await requireAdminSection('dealers');
  const store = await prisma.homeDepotStore.findUnique({ where: { id: storeId } });
  if (!store) return { ok: false, error: 'Store not found.' };
  const name = (store.name || '').trim();
  if (!name) return { ok: false, error: 'This store has no name to look up — set its location by hand instead.' };
  let hit: Awaited<ReturnType<typeof geocodeOSM>> = null;
  try {
    hit = await geocodeOSM(`The Home Depot ${name}, Ontario, Canada`);
  } catch {
    return { ok: false, error: 'The map lookup service didn’t answer — try again, or set the location by hand.' };
  }
  if (!hit) return { ok: false, error: 'Couldn’t find that store automatically — set its location by hand.' };
  await prisma.homeDepotStore.update({ where: { id: storeId }, data: { latitude: hit.lat, longitude: hit.lng, geocodedAt: new Date() } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'HomeDepotStore', entityId: storeId, detail: `Auto-placed store ${store.number} at ${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}` });
  revalidatePath('/admin/dealers/locations');
  return { ok: true, lat: hit.lat, lng: hit.lng };
}

/** Geocode a batch of not-yet-placed stores (throttled). Capped per call so an
 *  admin click stays quick; returns what it placed and how many still remain. */
export async function autoGeocodeAllStoresAction(): Promise<{ ok: boolean; placed: { id: string; lat: number; lng: number }[]; remaining: number }> {
  const session = await requireAdminSection('dealers');
  const todo = await prisma.homeDepotStore.findMany({
    where: { active: true, OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, number: true, name: true },
    take: 15,
  });
  const placed: { id: string; lat: number; lng: number }[] = [];
  for (const s of todo) {
    const name = (s.name || '').trim();
    if (!name) continue;
    let hit: Awaited<ReturnType<typeof geocodeOSM>> = null;
    try {
      hit = await geocodeOSM(`The Home Depot ${name}, Ontario, Canada`);
    } catch {
      break; // service down — stop and let the admin retry
    }
    if (hit) {
      await prisma.homeDepotStore.update({ where: { id: s.id }, data: { latitude: hit.lat, longitude: hit.lng, geocodedAt: new Date() } });
      placed.push({ id: s.id, lat: hit.lat, lng: hit.lng });
    }
  }
  if (placed.length) {
    await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'HomeDepotStore', entityId: 'bulk', detail: `Auto-placed ${placed.length} store location(s)` });
  }
  revalidatePath('/admin/dealers/locations');
  const remaining = await prisma.homeDepotStore.count({ where: { active: true, OR: [{ latitude: null }, { longitude: null }] } });
  return { ok: true, placed, remaining };
}

// ---- Guusto API test harness (Super Admin) --------------------------------

/** Fire a raw call to the Guusto API and return the response, for confirming the
 *  exact request shape against the live account before wiring it into the flow. */
export async function guustoTestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  if (!guustoConfigured()) {
    return { error: 'Add GUUSTO_API_TOKEN in Render → Environment (then redeploy) before testing.' };
  }
  const base = String(formData.get('base') || '').trim();
  const path = String(formData.get('path') || '/api/v1/orders').trim() || '/api/v1/orders';
  const method = (String(formData.get('method') || 'POST').trim() || 'POST').toUpperCase();
  const bodyText = String(formData.get('body') || '').trim();
  let body: unknown;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      return { error: 'The request body isn’t valid JSON — check for a stray comma or quote.' };
    }
  }
  const res = await guustoRequest(path, method, body, base || undefined);
  if (res.error) return { error: res.error };
  const pretty = typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2);
  return { ok: res.ok, message: `HTTP ${res.status}\n\n${pretty}` };
}

// ---- New-dealer intake (public /request-access) ---------------------------

/** Set (or clear) the shared access code for the public intake link. */
export async function setOnboardCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('user-requests');
  const code = String(formData.get('code') || '').trim().slice(0, 60);
  await setSetting(ONBOARD_CODE_KEY, code);
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'AppSetting', entityId: ONBOARD_CODE_KEY, detail: code ? 'Set intake access code' : 'Cleared intake access code (form closed)' });
  revalidatePath('/admin/user-requests');
  return { ok: true, message: code ? 'Access code saved.' : 'Code cleared — the public form is now closed.' };
}

/**
 * Attach an intake to an existing dealer: converts its people into a normal
 * login request on that dealer (so it flows through the usual approval queue),
 * and marks the intake handled. Lets an admin route a request to the right
 * dealer even when the typed company name doesn't match.
 */
/**
 * Build/refresh a dealer's Office Directory profile from a new-dealer intake.
 *
 * Non-destructive by design: creates the profile if the office has none (so it
 * moves out of "No profile yet" and gets a directory card), and on an existing
 * profile fills only empty office fields + appends people not already listed —
 * it never overwrites details an office has curated for itself. Each intake
 * person becomes one labelled contact card (role = their job title). Returns a
 * short human summary for the audit trail.
 */
async function applyOnboardToProfile(
  dealerId: string,
  actorId: string,
  onboard: {
    company: string;
    address: string | null; city: string | null; province: string | null; postal: string | null;
    officePhone: string | null; phone: string | null; website: string | null;
    logoStorageKey: string | null; logoMime: string | null;
    people: unknown;
  },
): Promise<string> {
  const existing = await prisma.dealerProfile.findUnique({ where: { dealerId } });

  // Office-level fields, composed from the intake.
  const officeName = titleOrNull(onboard.company);
  const addressLine =
    [onboard.address, onboard.city, onboard.province, onboard.postal].map((v) => (v ?? '').trim()).filter(Boolean).join(', ') || null;
  const officePhone = (onboard.officePhone || onboard.phone || '').trim() || null;
  const website = (onboard.website || '').trim() || null;

  // People → contact cards (each becomes an extra contact; role = job title).
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const people = (Array.isArray(onboard.people) ? onboard.people : []) as {
    name?: string; email?: string; phone?: string; jobTitle?: string; isMainContact?: boolean;
  }[];
  const incoming: OfficeContact[] = [];
  for (const p of people) {
    const name = toTitleCase(String(p.name ?? '').trim());
    const email = String(p.email ?? '').trim().toLowerCase();
    const phone = String(p.phone ?? '').trim().slice(0, 40);
    if (!name && !phone && !email) continue;
    const role = String(p.jobTitle ?? '').trim().slice(0, 60) || (p.isMainContact ? 'Owner / main contact' : 'Contact');
    incoming.push({ name, role, phone, email: emailRe.test(email) ? email : '' });
  }

  // Merge: keep every existing contact, add only ones not already present
  // (dedupe by email where we have one, else by name). Cap at the directory max.
  const prevExtras = existing ? readExtraContacts(existing.extraContacts) : [];
  const seenEmail = new Set(prevExtras.map((c) => c.email.toLowerCase()).filter(Boolean));
  const seenName = new Set(prevExtras.map((c) => c.name.toLowerCase()).filter(Boolean));
  const added: OfficeContact[] = [];
  for (const c of incoming) {
    const ek = c.email.toLowerCase();
    if (ek ? seenEmail.has(ek) : seenName.has(c.name.toLowerCase())) continue;
    if (ek) seenEmail.add(ek);
    seenName.add(c.name.toLowerCase());
    added.push(c);
  }
  const mergedExtras = [...prevExtras, ...added].slice(0, 12);

  if (!existing) {
    await prisma.dealerProfile.create({
      data: {
        dealerId,
        businessName: officeName,
        address: addressLine,
        phone: officePhone,
        website,
        extraContacts: mergedExtras as unknown as Prisma.InputJsonValue,
        updatedById: actorId,
      },
    });
  } else {
    await prisma.dealerProfile.update({
      where: { dealerId },
      data: {
        // Only fill blanks — never clobber what the office already set.
        businessName: existing.businessName ?? officeName,
        address: existing.address ?? addressLine,
        phone: existing.phone ?? officePhone,
        website: existing.website ?? website,
        extraContacts: mergedExtras as unknown as Prisma.InputJsonValue,
        updatedById: actorId,
      },
    });
  }

  // Copy the uploaded logo across, but only if the office has none yet.
  if (onboard.logoStorageKey && !existing?.logoStorageKey) {
    try {
      const bytes = await getDocument(onboard.logoStorageKey);
      const ext = path.extname(onboard.logoStorageKey).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
      const key = `dealer-logos/${dealerId}/${crypto.randomBytes(8).toString('hex')}${ext}`;
      await putDocument(key, bytes);
      await prisma.dealerProfile.update({ where: { dealerId }, data: { logoStorageKey: key, logoMime: onboard.logoMime || 'image/png' } });
    } catch {
      /* the logo is a nicety — never let a storage hiccup block the attach */
    }
  }

  return `${existing ? 'updated' : 'created'} profile, +${added.length} contact${added.length === 1 ? '' : 's'}`;
}

export async function attachOnboardToDealerAction(onboardId: string, formData: FormData): Promise<void> {
  const session = await requireAdminSection('user-requests');
  const dealerId = String(formData.get('dealerId') || '').trim();
  if (!dealerId) return;
  const fillProfile = String(formData.get('fillProfile') || '') === 'on';
  const [onboard, dealer] = await Promise.all([
    prisma.onboardRequest.findUnique({ where: { id: onboardId } }),
    prisma.dealer.findUnique({ where: { id: dealerId }, select: { id: true, name: true } }),
  ]);
  if (!onboard || onboard.status !== 'NEW' || !dealer) return;

  const people = (Array.isArray(onboard.people) ? onboard.people : []) as {
    name?: string; email?: string; phone?: string; jobTitle?: string; isMainContact?: boolean;
  }[];
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<string>();
  const rows: { name: string; email: string; phone: string | null; jobTitle: string | null; isMainContact: boolean }[] = [];
  for (const p of people) {
    const name = toTitleCase(String(p.name ?? '').trim());
    const email = String(p.email ?? '').trim().toLowerCase();
    if (!name || !emailRe.test(email) || seen.has(email)) continue;
    seen.add(email);
    rows.push({
      name,
      email,
      phone: String(p.phone ?? '').trim().slice(0, 40) || null,
      jobTitle: titleOrNull(String(p.jobTitle ?? '').trim().slice(0, 80)),
      isMainContact: p.isMainContact === true,
    });
  }

  if (rows.length > 0) {
    const note = `New-dealer intake: ${onboard.company}${onboard.city ? ` (${onboard.city})` : ''}${onboard.note ? ` — ${onboard.note}` : ''}`.slice(0, 500);
    const request = await prisma.userRequest.create({
      data: { dealerId, submittedById: session.userId, note, items: { create: rows } },
    });
    await audit({ actorId: session.userId, action: 'USER_REQUEST', entityType: 'UserRequest', entityId: request.id, detail: `From intake ${onboardId} → dealer ${dealer.name} (${rows.length} people)` });
  }
  // Optionally fold the intake's office details + people into the dealer's
  // Office Directory profile (create it if missing; fill blanks otherwise).
  let profileSummary = '';
  if (fillProfile) {
    try {
      profileSummary = await applyOnboardToProfile(dealerId, session.userId, onboard);
    } catch {
      /* directory fill is a convenience — never let it block the attach */
    }
  }

  await prisma.onboardRequest.update({ where: { id: onboardId }, data: { status: 'HANDLED', attachedDealerId: dealerId, handledAt: new Date(), handledById: session.userId } });
  await audit({
    actorId: session.userId,
    action: 'USER_REQUEST_DECISION',
    entityType: 'OnboardRequest',
    entityId: onboardId,
    detail: `Attached to dealer ${dealer.name}${profileSummary ? ` — directory ${profileSummary}` : ''}`,
  });
  revalidatePath('/admin/user-requests');
  if (fillProfile) revalidatePath('/staff/directory');
}

/**
 * Backfill an office's directory profile from an intake that's already on file
 * (e.g. one attached before directory-fill existed, or a "past" intake). Same
 * non-destructive fill as the attach flow — pick the office, fill from the
 * intake. Also records the dealer link on the intake for the record.
 */
export async function backfillProfileFromIntakeAction(onboardId: string, formData: FormData): Promise<void> {
  const session = await requireAdminSection('user-requests');
  const dealerId = String(formData.get('dealerId') || '').trim();
  if (!dealerId) return;
  const [onboard, dealer] = await Promise.all([
    prisma.onboardRequest.findUnique({ where: { id: onboardId } }),
    prisma.dealer.findUnique({ where: { id: dealerId }, select: { id: true, name: true } }),
  ]);
  if (!onboard || !dealer) return;

  let summary = '';
  try {
    summary = await applyOnboardToProfile(dealerId, session.userId, onboard);
  } catch {
    return; // storage/db hiccup — leave everything as-is
  }
  // Record the link if the intake wasn't already tied to a dealer.
  if (!onboard.attachedDealerId) {
    await prisma.onboardRequest.update({ where: { id: onboardId }, data: { attachedDealerId: dealerId } });
  }
  await audit({
    actorId: session.userId,
    action: 'DEALER_UPDATE',
    entityType: 'DealerProfile',
    entityId: dealerId,
    detail: `Directory ${summary} from intake ${onboard.company}`,
  });
  revalidatePath('/admin/user-requests');
  revalidatePath('/staff/directory');
}

/** Mark a new-dealer intake request handled (accounts set up) or dismiss it. */
export async function resolveOnboardRequestAction(id: string, outcome: 'HANDLED' | 'DISMISSED'): Promise<void> {
  const session = await requireAdminSection('user-requests');
  await prisma.onboardRequest.update({
    where: { id },
    data: { status: outcome, handledAt: new Date(), handledById: session.userId },
  });
  await audit({ actorId: session.userId, action: 'USER_REQUEST_DECISION', entityType: 'OnboardRequest', entityId: id, detail: outcome });
  revalidatePath('/admin/user-requests');
}

// ---- Go-live / pre-test data reset (Super Admin only) ---------------------

/** Wipe every deal (Application) + everything attached. Keeps everything else. */
export async function wipeDealsAction(confirm: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  const session = await requireSuperAdmin();
  if ((confirm || '').trim().toUpperCase() !== 'DELETE DEALS') {
    return { ok: false, error: 'Type DELETE DEALS exactly to confirm.' };
  }
  const res = await wipeDeals();
  await audit({ actorId: session.userId, action: 'DATA_RESET', entityType: 'Application', entityId: 'all', detail: `Wiped ${res.deals} deal(s), ${res.files} file(s)` });
  revalidatePath('/admin/reset');
  return { ok: true, message: `Removed ${res.deals} deal${res.deals === 1 ? '' : 's'} and ${res.files} file${res.files === 1 ? '' : 's'}.` };
}

/** Wipe every mail message + its thread. Keeps everything else. */
export async function wipeMailAction(confirm: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  const session = await requireSuperAdmin();
  if ((confirm || '').trim().toUpperCase() !== 'DELETE MAIL') {
    return { ok: false, error: 'Type DELETE MAIL exactly to confirm.' };
  }
  const res = await wipeMail();
  await audit({ actorId: session.userId, action: 'DATA_RESET', entityType: 'Mail', entityId: 'all', detail: `Wiped ${res.mails} mail message(s), ${res.files} attachment file(s)` });
  revalidatePath('/admin/reset');
  return { ok: true, message: `Removed ${res.mails} message${res.mails === 1 ? '' : 's'}.` };
}

/** Clear a store's location (drops it off the map until re-placed). */
export async function clearStoreLocationAction(storeId: string): Promise<StoreLocationResult> {
  const session = await requireAdminSection('dealers');
  const store = await prisma.homeDepotStore.findUnique({ where: { id: storeId } });
  if (!store) return { ok: false, error: 'Store not found.' };
  await prisma.homeDepotStore.update({ where: { id: storeId }, data: { latitude: null, longitude: null, geocodedAt: null } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'HomeDepotStore', entityId: storeId, detail: `Cleared store ${store.number} map location` });
  revalidatePath('/admin/dealers/locations');
  return { ok: true };
}

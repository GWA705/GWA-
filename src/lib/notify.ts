import type { ApplicationStatus, DocumentType, Role, User } from '@prisma/client';
import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { STATUS_LABELS, DOCUMENT_TYPE_LABELS } from './constants';
import { sendPushToRoles, sendPushToUser } from './push';
import { recordNotifications } from './notifications';

// Reviewers/admins who should receive activity notifications.
const STAFF_ROLES: Role[] = ['REVIEWER', 'ADMIN'];

/** Active staff (reviewer/admin) user ids — recipients for the in-app feed. */
async function staffUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: STAFF_ROLES }, active: true }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Full customer name for the in-app feed label (shown only to authorized users). */
function customerNameOf(app: { applicantFirstName: string; applicantLastName: string }): string {
  return `${app.applicantFirstName ?? ''} ${app.applicantLastName ?? ''}`.trim() || 'a customer';
}

/**
 * Run a notification WITHOUT making the caller wait for it. Staff emails + push
 * are external network calls (often several seconds for a handful of reviewers);
 * a dealer submitting or cancelling a deal should never sit through them. We run
 * on a persistent Node server (Elastic Beanstalk), so the process stays alive
 * after the HTTP response is sent and the send finishes in the background. Errors
 * are logged, never thrown — matching the best-effort contract of every notifier.
 *
 * Only safe for notifiers that don't need request-scoped context (these don't —
 * they read from prisma + env), and whose result the caller doesn't use.
 */
export function notifyInBackground(label: string, run: () => unknown): void {
  void Promise.resolve()
    .then(run)
    .catch((e) => console.error(`[notify] ${label} (background) failed`, e));
}

/**
 * Notification helpers. Each is best-effort — a failure never breaks the action
 * that triggered it. Emails carry no sensitive personal information; they link
 * back to the portal. While email is in log-only mode these just log.
 */

function appUrl(): string {
  return (process.env.APP_URL || '').replace(/\/$/, '');
}
function recipientEmail(u: Pick<User, 'email' | 'notificationEmail'>): string {
  return u.notificationEmail || u.email;
}

// A short, low-sensitivity label for a deal so notifications say which one they
// mean: the customer's first name + last initial (e.g. "John D."). Full customer
// names are deliberately kept out of email.
function dealLabel(app: { applicantFirstName: string; applicantLastName: string }): string {
  const first = (app.applicantFirstName || '').trim();
  const lastInitial = (app.applicantLastName || '').trim().charAt(0);
  const label = `${first}${lastInitial ? ` ${lastInitial}.` : ''}`.trim();
  return label || 'a deal';
}

/** Dealer users of a deal have their status updated. */
export async function notifyStatusChange(applicationId: string, toStatus: ApplicationStatus) {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return;
    const users = await prisma.user.findMany({
      where: { dealerId: app.dealerId, role: 'DEALER_USER', active: true, notifyStatusUpdates: true },
    });
    const label = STATUS_LABELS[toStatus];
    const deal = dealLabel(app);
    for (const u of users) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `Deal update (${deal}): ${label}`,
        html: renderEmail({
          heading: 'Deal status updated',
          intro: `The deal for ${deal} has moved to “${label}”.`,
          ctaLabel: 'View deal',
          ctaUrl: `${appUrl()}/dealer/applications/${applicationId}`,
        }),
      });
    }
    await recordNotifications(users.map((u) => u.id), {
      title: `Deal update: ${label}`,
      body: `${deal} moved to “${label}”.`,
      url: `/dealer/applications/${applicationId}`,
      category: 'status',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] status change failed', e);
  }
}

// Group uploaded document types into a human list like
// ["Void cheque / PAP form", "Document for approval (×2)"].
function summarizeDocTypes(types: DocumentType[]): string[] {
  const counts = new Map<DocumentType, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([t, n]) => {
    const label = DOCUMENT_TYPE_LABELS[t] ?? 'Document';
    return n > 1 ? `${label} (×${n})` : label;
  });
}

// New-document alerts are debounced per deal: a dealer often uploads several
// documents in a row (each its own form), and we want ONE notification that
// lists everything — not four buzzes back to back. Each upload (re)starts a
// short trailing timer; when it fires, we send a single digest naming what was
// uploaded in the burst. This relies on the app running as a long-lived server
// (it does). A restart mid-window drops a pending digest, which is acceptable —
// all notifications here are best-effort.
const DOC_NOTIFY_DEBOUNCE_MS = 90_000;
const pendingDocNotifications = new Map<string, { types: DocumentType[]; timer: NodeJS.Timeout }>();

/** Reviewers/admins are alerted when a dealer uploads documents (debounced). */
export function notifyNewDocuments(applicationId: string, uploadedTypes: DocumentType[]) {
  if (uploadedTypes.length === 0) return;
  const existing = pendingDocNotifications.get(applicationId);
  if (existing) clearTimeout(existing.timer);
  const types = existing ? [...existing.types, ...uploadedTypes] : [...uploadedTypes];
  const timer = setTimeout(() => {
    pendingDocNotifications.delete(applicationId);
    void flushNewDocuments(applicationId, types).catch((e) =>
      console.error('[notify] new documents flush failed', e),
    );
  }, DOC_NOTIFY_DEBOUNCE_MS);
  // Don't let a pending digest keep the process alive on its own.
  if (typeof timer.unref === 'function') timer.unref();
  pendingDocNotifications.set(applicationId, { types, timer });
}

async function flushNewDocuments(applicationId: string, types: DocumentType[]) {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { dealer: true } });
  if (!app) return;
  const staff = await prisma.user.findMany({
    where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true, notifyNewDocuments: true },
  });
  const deal = dealLabel(app);
  const labels = summarizeDocTypes(types);
  const count = types.length;
  const heading = count === 1 ? 'New document uploaded' : `${count} new documents uploaded`;
  const listHtml = `<ul style="margin:0 0 14px;padding-left:18px;font-size:14px;line-height:1.6;color:#374151;">${labels
    .map((l) => `<li>${l}</li>`)
    .join('')}</ul>`;

  for (const u of staff) {
    await sendEmail({
      to: recipientEmail(u),
      subject: `${heading} (${deal})`,
      html: renderEmail({
        heading,
        intro: `The following ${count === 1 ? 'document was' : 'documents were'} uploaded on the deal for ${deal} (${app.dealer.name}):`,
        bodyHtml: listHtml,
        ctaLabel: 'Review deal',
        ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
      }),
    });
  }
  await sendPushToRoles(STAFF_ROLES, {
    title: heading,
    body: `${deal} (${app.dealer.name}): ${labels.join(', ')}`,
    url: `/staff/applications/${applicationId}`,
    tag: `docs-${applicationId}`,
  });
  await recordNotifications(staff.map((u) => u.id), {
    title: heading,
    body: `${app.dealer.name}: ${labels.join(', ')}`,
    url: `/staff/applications/${applicationId}`,
    category: 'documents',
    applicationId,
    customerName: customerNameOf(app),
  });
}

/**
 * Reviewers/admins are alerted when a dealer submits a new deal. Sends BOTH email
 * and push: push can silently lapse (expired browser subscription, notifications
 * turned off, iOS PWA quirks), so email is the reliable channel that guarantees a
 * new deal is seen. Emails every active reviewer/admin — new deals are the core
 * job, so this isn't gated behind an opt-in preference.
 */
export async function notifyNewSubmission(applicationId: string) {
  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { dealer: true },
    });
    if (!app) return;
    const deal = dealLabel(app);

    const staff = await prisma.user.findMany({
      where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true, notifyNewSubmission: true },
    });
    for (const u of staff) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `New deal submitted (${deal})`,
        html: renderEmail({
          heading: 'A new deal was submitted',
          intro: `${deal} — ${app.dealer.name} just submitted a new deal for review.`,
          bodyHtml: '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">Open it to review and start the approval.</p>',
          ctaLabel: 'Review deal',
          ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
        }),
      });
    }

    await sendPushToRoles(STAFF_ROLES, {
      title: 'New deal submitted',
      body: `${deal} (${app.dealer.name}) — a new deal was submitted.`,
      url: `/staff/applications/${applicationId}`,
      tag: `submit-${applicationId}`,
    });
    await recordNotifications(staff.map((u) => u.id), {
      title: 'New deal submitted',
      body: `${app.dealer.name} submitted a new deal for review.`,
      url: `/staff/applications/${applicationId}`,
      category: 'submission',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] new submission failed', e);
  }
}

/** Reviewers/admins are alerted when a dealer submits the funding package. Email +
 * push (email is the reliable channel — see notifyNewSubmission). */
export async function notifyFundingSubmitted(applicationId: string) {
  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { dealer: true },
    });
    if (!app) return;
    const deal = dealLabel(app);

    const staff = await prisma.user.findMany({
      where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true, notifyNewSubmission: true },
    });
    for (const u of staff) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `Funding package submitted (${deal})`,
        html: renderEmail({
          heading: 'A funding package was submitted',
          intro: `${deal} — ${app.dealer.name} submitted the signed funding package.`,
          bodyHtml: '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">Open it to review the signed documents and move it toward funding.</p>',
          ctaLabel: 'Review deal',
          ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
        }),
      });
    }

    await sendPushToRoles(STAFF_ROLES, {
      title: 'Funding package submitted',
      body: `${deal} (${app.dealer.name}) — funding package submitted.`,
      url: `/staff/applications/${applicationId}`,
      tag: `funding-${applicationId}`,
    });
    await recordNotifications(staff.map((u) => u.id), {
      title: 'Funding package submitted',
      body: `${app.dealer.name} submitted the signed funding package.`,
      url: `/staff/applications/${applicationId}`,
      category: 'funding',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] funding submitted failed', e);
  }
}

/**
 * Out-of-band paperwork: a dealer uploaded signed funding documents on a deal
 * that is still Approved/Conditional — i.e. the install documents were never sent
 * through the portal (they were handled another way, e.g. emailed because the
 * dealer couldn't log in). Normally funding docs only come back AFTER "Sent —
 * awaiting install", so this is an exception the reviewer must see: the deal has
 * effectively advanced but is sitting at Approved. Alerts reviewers/admins so it
 * doesn't get stuck.
 */
export async function notifyFundingDocsBeforeSend(applicationId: string) {
  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { dealer: true },
    });
    if (!app) return;
    const deal = dealLabel(app);
    const staff = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, active: true },
      select: { id: true, email: true, notificationEmail: true },
    });
    for (const u of staff) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `⚠️ Paperwork uploaded before install docs were sent (${deal})`,
        html: renderEmail({
          heading: 'Dealer uploaded paperwork on a deal that hasn’t had install documents sent',
          intro: `${app.dealer.name} uploaded signed paperwork for ${deal}, but this deal is still Approved — its install documents were never sent through the portal.`,
          bodyHtml:
            '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">If the documents were sent another way (e.g. emailed), open the deal, review what the dealer uploaded, and move it forward so it doesn’t stay stuck at Approved.</p>',
          ctaLabel: 'Open deal',
          ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
        }),
      });
    }
    await sendPushToRoles(STAFF_ROLES, {
      title: 'Paperwork arrived early — needs review',
      body: `${deal} (${app.dealer.name}) — dealer uploaded paperwork while the deal is still Approved (install docs not sent in-portal).`,
      url: `/staff/applications/${applicationId}`,
      tag: `oob-${applicationId}`,
    });
    await recordNotifications(staff.map((u) => u.id), {
      title: 'Paperwork arrived early — needs review',
      body: `${app.dealer.name} uploaded paperwork while the deal is still Approved (install docs not sent in-portal).`,
      url: `/staff/applications/${applicationId}`,
      category: 'funding',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] funding docs before send failed', e);
  }
}

/**
 * A dealer requested to cancel a deal — reviewers/admins are alerted (email +
 * push) so they can confirm it. A funded deal is flagged as a priority because a
 * Home Depot refund is owed before it can be finalized.
 */
export async function notifyCancellationRequested(applicationId: string, wasFunded: boolean) {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { dealer: true } });
    if (!app) return;
    const deal = dealLabel(app);
    const priority = wasFunded ? '⚠️ Priority — ' : '';
    const refundLine = wasFunded
      ? 'This deal was already <strong>funded</strong>, so a Home Depot refund is owed. Process the refund with Home Depot and confirm it before finalizing the cancellation.'
      : 'Review the request and confirm or reject the cancellation.';
    const staff = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, active: true },
      select: { id: true, email: true, notificationEmail: true },
    });
    for (const u of staff) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `${priority}Cancellation requested (${deal})`,
        html: renderEmail({
          heading: 'A dealer requested to cancel a deal',
          intro: `${app.dealer.name} asked to cancel the deal for ${deal}.`,
          bodyHtml: `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">${refundLine}</p>`,
          ctaLabel: 'Review the request',
          ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
        }),
      });
    }
    await sendPushToRoles(STAFF_ROLES, {
      title: wasFunded ? 'Cancellation — refund needed' : 'Cancellation requested',
      body: `${deal} (${app.dealer.name}) — a dealer requested to cancel this deal.`,
      url: `/staff/applications/${applicationId}`,
      tag: `cancel-${applicationId}`,
    });
    await recordNotifications(staff.map((u) => u.id), {
      title: wasFunded ? 'Cancellation — refund needed' : 'Cancellation requested',
      body: `${app.dealer.name} requested to cancel this deal.`,
      url: `/staff/applications/${applicationId}`,
      category: 'cancellation',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] cancellation requested failed', e);
  }
}

/** A reviewer confirmed or rejected a dealer's cancellation — the dealer is told. */
export async function notifyCancellationResolved(applicationId: string, confirmed: boolean, note?: string | null) {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return;
    const deal = dealLabel(app);
    const users = await prisma.user.findMany({
      where: { dealerId: app.dealerId, role: 'DEALER_USER', active: true },
      select: { id: true, email: true, notificationEmail: true },
    });
    const heading = confirmed ? 'Your cancellation was confirmed' : 'Your cancellation request was declined';
    const intro = confirmed
      ? `The cancellation of the deal for ${deal} has been confirmed by a reviewer. The deal is now closed.`
      : `A reviewer declined the request to cancel the deal for ${deal}. It remains active.`;
    const noteHtml = note && note.trim()
      ? `<p style="margin:0 0 14px;font-size:14px;color:#374151;"><strong>Reviewer note:</strong> ${note.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      : '';
    for (const u of users) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `${confirmed ? 'Cancellation confirmed' : 'Cancellation declined'} (${deal})`,
        html: renderEmail({ heading, intro, bodyHtml: noteHtml, ctaLabel: 'Open deal', ctaUrl: `${appUrl()}/dealer/applications/${applicationId}` }),
      });
    }
    for (const u of users) {
      await sendPushToUser(u.id, {
        title: heading,
        body: `${deal} — ${confirmed ? 'cancellation confirmed' : 'request declined'}.`,
        url: `/dealer/applications/${applicationId}`,
        tag: `cancel-res-${applicationId}`,
      });
    }
    await recordNotifications(users.map((u) => u.id), {
      title: confirmed ? 'Cancellation confirmed' : 'Cancellation declined',
      body: confirmed ? `${deal} — the deal is now closed.` : `${deal} — the request was declined; the deal remains active.`,
      url: `/dealer/applications/${applicationId}`,
      category: 'cancellation',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] cancellation resolved failed', e);
  }
}

/** A new note notifies the other side of the conversation. */
export async function notifyNewNote(applicationId: string, authorRole: Role) {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return;
    const deal = dealLabel(app);
    if (authorRole === 'DEALER_USER') {
      const staff = await prisma.user.findMany({
        where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true, notifyNewNotes: true },
      });
      for (const u of staff) {
        await sendEmail({
          to: recipientEmail(u),
          subject: `New note from a dealer (${deal})`,
          html: renderEmail({
            heading: 'New note from a dealer',
            intro: `A dealer added a note on the deal for ${deal}.`,
            ctaLabel: 'Open deal',
            ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
          }),
        });
      }
      await sendPushToRoles(STAFF_ROLES, {
        title: 'New note from a dealer',
        body: `${deal} — a dealer added a note.`,
        url: `/staff/applications/${applicationId}`,
        tag: `note-${applicationId}`,
      });
      await recordNotifications(staff.map((u) => u.id), {
        title: 'New note from a dealer',
        body: 'A dealer added a note on this deal.',
        url: `/staff/applications/${applicationId}`,
        category: 'note',
        applicationId,
        customerName: customerNameOf(app),
      });
    } else {
      const users = await prisma.user.findMany({
        where: { dealerId: app.dealerId, role: 'DEALER_USER', active: true, notifyNewNotes: true },
      });
      for (const u of users) {
        await sendEmail({
          to: recipientEmail(u),
          subject: `New note from GWA (${deal})`,
          html: renderEmail({
            heading: 'New note from GWA',
            intro: `The GWA team added a note on your deal for ${deal}.`,
            ctaLabel: 'Open deal',
            ctaUrl: `${appUrl()}/dealer/applications/${applicationId}`,
          }),
        });
      }
      await recordNotifications(users.map((u) => u.id), {
        title: 'New note from GWA',
        body: 'The GWA team added a note on your deal.',
        url: `/dealer/applications/${applicationId}`,
        category: 'note',
        applicationId,
        customerName: customerNameOf(app),
      });
    }
  } catch (e) {
    console.error('[notify] new note failed', e);
  }
}

/**
 * A confirmer flagged an issue to the dealer (confirmation call). This is
 * action-required — the office must acknowledge it — so, unlike routine notes,
 * it emails + pushes EVERY active user at the dealer regardless of their
 * "new notes" preference, pointing them at the mail where they acknowledge.
 * Returns how many office users were notified. Best-effort; never throws.
 */
export async function notifyConfirmationIssue(applicationId: string, mailId: string): Promise<number> {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return 0;
    const deal = dealLabel(app);
    const users = await prisma.user.findMany({
      where: { dealerId: app.dealerId, role: 'DEALER_USER', active: true },
    });
    for (const u of users) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `⚠ ACTION REQUIRED: confirmation issue on ${deal} — please acknowledge`,
        html: renderEmail({
          heading: '⚠ Action required — please review & acknowledge',
          intro: `A Georgian Water & Air confirmation reviewer flagged an issue on your deal for ${deal} during the confirmation call.`,
          bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">
            <tr><td style="border-left:4px solid #dc2626;background:#fef2f2;border-radius:6px;padding:12px 14px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#991b1b;font-weight:700;">This needs your attention now.</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#991b1b;">Open the deal, review the details, and confirm you&rsquo;ve read it. It stays flagged — on the deal and in your portal mail — until someone at your office acknowledges it.</p>
            </td></tr>
          </table>`,
          ctaLabel: 'Open & acknowledge now',
          ctaUrl: `${appUrl()}/dealer/mail/${mailId}`,
        }),
      });
      await sendPushToUser(u.id, {
        title: '⚠ Action required on a deal',
        body: `${deal} — a confirmation issue needs your review and acknowledgement.`,
        url: `/dealer/mail/${mailId}`,
        tag: `issue-${mailId}`,
      });
    }
    await recordNotifications(users.map((u) => u.id), {
      title: '⚠ Action required on a deal',
      body: `${deal} — a confirmation issue needs your review and acknowledgement.`,
      url: `/dealer/mail/${mailId}`,
      category: 'action-required',
      applicationId,
      customerName: customerNameOf(app),
    });
    return users.length;
  } catch (e) {
    console.error('[notify] confirmation issue failed', e);
    return 0;
  }
}

/**
 * A mail thread got a reply. When a dealer replies, notify GWA staff (the mail
 * sender + staff who watch new notes) by email and push. When staff reply back,
 * notify that dealer's users. Best-effort; never breaks the reply itself.
 */
export async function notifyMailReply(
  mailId: string,
  dealerId: string,
  fromStaff: boolean,
) {
  try {
    const mail = await prisma.mail.findUnique({
      where: { id: mailId },
      select: { subject: true, senderId: true, distributorsOnly: true },
    });
    if (!mail) return;
    const subject = mail.subject;

    if (!fromStaff) {
      // Dealer replied → tell staff. Email the sender + any staff who opted into
      // note notifications, and push to all staff.
      const staff = await prisma.user.findMany({
        where: {
          active: true,
          role: { in: ['REVIEWER', 'ADMIN'] },
          OR: [{ id: mail.senderId }, { notifyNewNotes: true }],
        },
      });
      for (const u of staff) {
        await sendEmail({
          to: recipientEmail(u),
          subject: `New reply from a dealer — ${subject}`,
          html: renderEmail({
            heading: 'New mail reply from a dealer',
            intro: `A dealer replied to your message “${subject}”.`,
            ctaLabel: 'Open the thread',
            ctaUrl: `${appUrl()}/staff/mail/${mailId}`,
          }),
        });
      }
      await sendPushToRoles(STAFF_ROLES, {
        title: 'New mail reply from a dealer',
        body: subject,
        url: `/staff/mail/${mailId}`,
        tag: `mailreply-${mailId}`,
      });
      await recordNotifications(staff.map((u) => u.id), {
        title: 'New mail reply from a dealer',
        body: subject,
        url: `/staff/mail/${mailId}`,
        category: 'mail',
      });
    } else {
      // Staff replied → tell the dealer's users (only distributors when the
      // original mail was distributors-only).
      const users = await prisma.user.findMany({
        where: {
          dealerId,
          role: 'DEALER_USER',
          active: true,
          ...(mail.distributorsOnly ? { isDistributor: true } : {}),
        },
      });
      for (const u of users) {
        await sendEmail({
          to: recipientEmail(u),
          subject: `New reply from GWA — ${subject}`,
          html: renderEmail({
            heading: 'New reply from GWA',
            intro: `GWA replied on the message “${subject}”.`,
            ctaLabel: 'Open the message',
            ctaUrl: `${appUrl()}/dealer/mail/${mailId}`,
          }),
        });
        await sendPushToUser(u.id, {
          title: 'New reply from GWA',
          body: subject,
          url: `/dealer/mail/${mailId}`,
          tag: `mailreply-${mailId}`,
        });
      }
      await recordNotifications(users.map((u) => u.id), {
        title: 'New reply from GWA',
        body: subject,
        url: `/dealer/mail/${mailId}`,
        category: 'mail',
      });
    }
  } catch (e) {
    console.error('[notify] mail reply failed', e);
  }
}

/**
 * Tell admins a dealer has requested new portal logins, so requests don't sit in
 * the queue unseen. Best-effort email to every active admin; the in-app nav also
 * badges the "User requests" section.
 */
export async function notifyAdminsUserRequest(requestId: string) {
  try {
    const req = await prisma.userRequest.findUnique({
      where: { id: requestId },
      include: { dealer: { select: { name: true } }, items: { select: { id: true } } },
    });
    if (!req) return;
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true } });
    const count = req.items.length;
    for (const a of admins) {
      await sendEmail({
        to: recipientEmail(a),
        subject: `New login request from ${req.dealer.name}`,
        html: renderEmail({
          heading: 'New user request',
          intro: `${req.dealer.name} has requested ${count} new login${count === 1 ? '' : 's'}. Review and approve them in the portal.`,
          ctaLabel: 'Review requests',
          ctaUrl: `${appUrl()}/admin/user-requests`,
        }),
      });
    }
    await recordNotifications(admins.map((a) => a.id), {
      title: 'New login request',
      body: `${req.dealer.name} requested ${count} new login${count === 1 ? '' : 's'}.`,
      url: `/admin/user-requests`,
      category: 'user-request',
    });
  } catch (e) {
    console.error('[notify] user request failed', e);
  }
}

/**
 * A gift-card request got a new note or a contact edit. When the dealer writes,
 * push the staff who work the queue; when staff write, push the dealer who
 * requested it. Best-effort — never breaks the note itself.
 */
export async function notifyGiftCardNote(requestId: string, fromDealer: boolean) {
  try {
    const gc = await prisma.giftCardRequest.findUnique({ where: { id: requestId } });
    if (!gc) return;
    const who = gc.customerName;
    if (fromDealer) {
      await sendPushToRoles(STAFF_ROLES, {
        title: 'Gift card — new message',
        body: `A dealer updated the gift card for ${who}. Check the Gift cards area.`,
        url: '/staff/gift-cards',
        tag: `giftcard-${requestId}`,
      });
      await recordNotifications(await staffUserIds(), {
        title: 'Gift card — new message',
        body: `A dealer updated the gift card for ${who}.`,
        url: '/staff/gift-cards',
        category: 'gift-card',
        customerName: who,
      });
    } else {
      await sendPushToUser(gc.requestedById, {
        title: 'Gift card — new message',
        body: `An update on the gift card for ${who}. Check your Gift cards area.`,
        url: '/dealer/gift-cards',
        tag: `giftcard-${requestId}`,
      });
      await recordNotifications([gc.requestedById], {
        title: 'Gift card — new message',
        body: `An update on the gift card for ${who}.`,
        url: '/dealer/gift-cards',
        category: 'gift-card',
        customerName: who,
      });
    }
  } catch (e) {
    console.error('[notify] gift-card note failed', e);
  }
}

/**
 * A dealer added a co-applicant to an existing deal. This changes the credit
 * application, so reviewers/admins are told to re-check credit with both
 * applicants (the deal is moved back to review by the caller).
 */
export async function notifyCoApplicantAdded(applicationId: string, coName: string, wasReset: boolean) {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { dealer: true } });
    if (!app) return;
    const deal = dealLabel(app);
    const staff = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, active: true },
      select: { id: true, email: true, notificationEmail: true },
    });
    const resetLine = wasReset
      ? 'The deal has been moved back to review so credit can be re-checked with both applicants.'
      : 'Review the deal with both applicants.';
    for (const u of staff) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `Co-applicant added — re-check credit (${deal})`,
        html: renderEmail({
          heading: 'A co-applicant was added to a deal',
          intro: `${app.dealer.name} added a co-applicant (${coName}) to the deal for ${deal}. ${resetLine}`,
          ctaLabel: 'Open deal',
          ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
        }),
      });
    }
    await sendPushToRoles(STAFF_ROLES, {
      title: 'Co-applicant added — re-check credit',
      body: `${deal} (${app.dealer.name}) — a co-applicant was added.`,
      url: `/staff/applications/${applicationId}`,
      tag: `coapp-${applicationId}`,
    });
    await recordNotifications(staff.map((u) => u.id), {
      title: 'Co-applicant added — re-check credit',
      body: `${app.dealer.name} added a co-applicant${wasReset ? '; the deal is back in review.' : '.'}`,
      url: `/staff/applications/${applicationId}`,
      category: 'co-applicant',
      applicationId,
      customerName: customerNameOf(app),
    });
  } catch (e) {
    console.error('[notify] co-applicant added failed', e);
  }
}

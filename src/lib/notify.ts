import type { ApplicationStatus, DocumentType, Role, User } from '@prisma/client';
import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { STATUS_LABELS, DOCUMENT_TYPE_LABELS } from './constants';
import { sendPushToRoles, sendPushToUser } from './push';

// Reviewers/admins who should receive activity notifications.
const STAFF_ROLES: Role[] = ['REVIEWER', 'ADMIN'];

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
}

/** Reviewers/admins are alerted when a dealer submits a new deal. Push only. */
export async function notifyNewSubmission(applicationId: string) {
  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { dealer: true },
    });
    if (!app) return;
    await sendPushToRoles(STAFF_ROLES, {
      title: 'New deal submitted',
      body: `${dealLabel(app)} (${app.dealer.name}) — a new deal was submitted.`,
      url: `/staff/applications/${applicationId}`,
      tag: `submit-${applicationId}`,
    });
  } catch (e) {
    console.error('[notify] new submission failed', e);
  }
}

/** Reviewers/admins are alerted when a dealer submits the funding package. Push only. */
export async function notifyFundingSubmitted(applicationId: string) {
  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { dealer: true },
    });
    if (!app) return;
    await sendPushToRoles(STAFF_ROLES, {
      title: 'Funding package submitted',
      body: `${dealLabel(app)} (${app.dealer.name}) — funding package submitted.`,
      url: `/staff/applications/${applicationId}`,
      tag: `funding-${applicationId}`,
    });
  } catch (e) {
    console.error('[notify] funding submitted failed', e);
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
    }
  } catch (e) {
    console.error('[notify] new note failed', e);
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
    } else {
      await sendPushToUser(gc.requestedById, {
        title: 'Gift card — new message',
        body: `An update on the gift card for ${who}. Check your Gift cards area.`,
        url: '/dealer/gift-cards',
        tag: `giftcard-${requestId}`,
      });
    }
  } catch (e) {
    console.error('[notify] gift-card note failed', e);
  }
}

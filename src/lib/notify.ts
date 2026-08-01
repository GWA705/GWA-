import type { ApplicationStatus, Role, User } from '@prisma/client';
import { prisma } from './db';
import { sendEmail } from './email';
import { renderEmail } from './email-templates';
import { STATUS_LABELS } from './constants';
import { sendPushToRoles } from './push';

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

/** Reviewers/admins are alerted when a dealer uploads documents. */
export async function notifyNewDocuments(applicationId: string) {
  try {
    const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { dealer: true } });
    if (!app) return;
    const staff = await prisma.user.findMany({
      where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true, notifyNewDocuments: true },
    });
    const deal = dealLabel(app);
    for (const u of staff) {
      await sendEmail({
        to: recipientEmail(u),
        subject: `New documents uploaded (${deal})`,
        html: renderEmail({
          heading: 'New documents uploaded',
          intro: `New document(s) were uploaded on the deal for ${deal} (${app.dealer.name}).`,
          ctaLabel: 'Review deal',
          ctaUrl: `${appUrl()}/staff/applications/${applicationId}`,
        }),
      });
    }
    await sendPushToRoles(STAFF_ROLES, {
      title: 'New documents uploaded',
      body: `${deal} (${app.dealer.name}) — new document(s) uploaded.`,
      url: `/staff/applications/${applicationId}`,
      tag: `docs-${applicationId}`,
    });
  } catch (e) {
    console.error('[notify] new documents failed', e);
  }
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

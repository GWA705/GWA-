import 'server-only';
import { prisma } from './db';
import { deleteDocument } from './storage';

/**
 * Go-live / pre-test reset helpers. Two independent wipes:
 *   - deals  : every Application and everything attached to it (documents, notes,
 *              decisions, payouts, files, related audit + webhook rows).
 *   - mail   : every Mail and its replies/recipients/receipts/attachments.
 *
 * Neither touches dealers, users, marketplace, resources, finance companies,
 * products, gift cards, settings, or anything else. Used by the Super-Admin
 * "Reset test data" page and by scripts/wipe-deals.ts.
 */

export interface DealCounts {
  deals: number;
  files: number;
  notes: number;
  decisions: number;
  statusEvents: number;
  payouts: number;
  auditEntries: number;
}

export async function dealCounts(): Promise<DealCounts> {
  const apps = await prisma.application.findMany({ select: { id: true } });
  const appIds = apps.map((a) => a.id);
  const docs = await prisma.document.findMany({ where: { applicationId: { in: appIds } }, select: { id: true } });
  const docIds = docs.map((d) => d.id);
  const auditWhere = {
    OR: [
      { entityType: 'Application', entityId: { in: appIds } },
      { entityType: 'Document', entityId: { in: docIds } },
    ],
  };
  const [notes, decisions, statusEvents, payouts, auditEntries] = await Promise.all([
    prisma.note.count({ where: { applicationId: { in: appIds } } }),
    prisma.decision.count({ where: { applicationId: { in: appIds } } }),
    prisma.statusEvent.count({ where: { applicationId: { in: appIds } } }),
    prisma.payout.count({ where: { applicationId: { in: appIds } } }),
    prisma.auditLog.count({ where: auditWhere }),
  ]);
  return { deals: appIds.length, files: docs.length, notes, decisions, statusEvents, payouts, auditEntries };
}

/** Delete every deal and everything attached. Returns how many deals were removed. */
export async function wipeDeals(): Promise<{ deals: number; files: number }> {
  const apps = await prisma.application.findMany({ select: { id: true } });
  const appIds = apps.map((a) => a.id);
  if (appIds.length === 0) return { deals: 0, files: 0 };

  const docs = await prisma.document.findMany({ where: { applicationId: { in: appIds } }, select: { id: true, storageKey: true } });
  const docIds = docs.map((d) => d.id);

  // File blobs (best-effort; an orphaned blob is harmless).
  let files = 0;
  for (const d of docs) {
    try {
      await deleteDocument(d.storageKey);
      files += 1;
    } catch {
      /* orphaned blob, ignore */
    }
  }

  // String-referenced rows (no FK cascade).
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: 'Application', entityId: { in: appIds } },
        { entityType: 'Document', entityId: { in: docIds } },
      ],
    },
  });
  await prisma.webhookEvent.deleteMany({ where: { applicationId: { in: appIds } } });

  const where = { applicationId: { in: appIds } };
  await prisma.$transaction([
    prisma.paymentSplit.deleteMany({ where }),
    prisma.verificationCheck.deleteMany({ where }),
    prisma.confirmation.deleteMany({ where }),
    prisma.dealerReminder.deleteMany({ where }),
    prisma.serialNumber.deleteMany({ where }),
    prisma.payout.deleteMany({ where }),
    prisma.decision.deleteMany({ where }),
    prisma.statusEvent.deleteMany({ where }),
    prisma.consent.deleteMany({ where }),
    prisma.note.deleteMany({ where }),
    prisma.loanApplication.deleteMany({ where }),
    prisma.document.deleteMany({ where }),
    prisma.application.deleteMany({ where: { id: { in: appIds } } }),
  ]);

  return { deals: appIds.length, files };
}

export interface MailCounts {
  mails: number;
  replies: number;
  attachments: number;
}

export async function mailCounts(): Promise<MailCounts> {
  const [mails, replies, attachments] = await Promise.all([
    prisma.mail.count(),
    prisma.mailReply.count(),
    prisma.mailAttachment.count(),
  ]);
  return { mails, replies, attachments };
}

/** Delete every mail message and its thread (replies/recipients/receipts/attachments). */
export async function wipeMail(): Promise<{ mails: number; files: number }> {
  const mails = await prisma.mail.findMany({ select: { id: true } });
  const mailIds = mails.map((m) => m.id);
  if (mailIds.length === 0) return { mails: 0, files: 0 };

  // Attachment blobs (best-effort); DB rows cascade when the mail is deleted.
  const atts = await prisma.mailAttachment.findMany({ select: { storageKey: true } });
  let files = 0;
  for (const a of atts) {
    try {
      await deleteDocument(a.storageKey);
      files += 1;
    } catch {
      /* orphaned blob, ignore */
    }
  }

  // Deleting the mail cascades recipients, userRecipients, receipts, replies,
  // attachments (and their views).
  const del = await prisma.mail.deleteMany({});
  return { mails: del.count, files };
}

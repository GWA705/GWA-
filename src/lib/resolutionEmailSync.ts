import 'server-only';
import { prisma } from './db';
import { fetchThreadMessages, fetchMessagesForAddress, gmailResolutionConfigured, type GmailMessage } from './gmailResolution';
import { OPEN_STATUSES } from './resolutionStatus';

/**
 * Pull new messages into a case's ResolutionEmail: the linked HD thread, PLUS any
 * extra watched addresses (watchEmails) and the customer's own email — so info a
 * customer or an extra HD contact sends us lands in the case file automatically.
 */
export async function syncCaseEmails(caseId: string): Promise<{ added: number }> {
  if (!gmailResolutionConfigured()) return { added: 0 };
  const c = await prisma.resolutionCase.findUnique({
    where: { id: caseId },
    select: {
      id: true, gmailThreadId: true, watchEmails: true, customerEmail: true,
      application: { select: { applicantEmail: true } },
    },
  });
  if (!c) return { added: 0 };
  if (!c.gmailThreadId && (c.watchEmails?.length ?? 0) === 0 && !c.customerEmail && !c.application?.applicantEmail) {
    return { added: 0 };
  }

  const msgs: GmailMessage[] = [];

  // 1) The linked HD thread.
  if (c.gmailThreadId) {
    try { msgs.push(...(await fetchThreadMessages(c.gmailThreadId))); }
    catch (e) { console.error('[resolution-email] thread fetch failed', caseId, e); }
  }

  // 2) Extra watched addresses + the customer's own email (always watched).
  const addrs = new Set<string>();
  for (const a of c.watchEmails ?? []) { const x = (a || '').trim().toLowerCase(); if (x.includes('@')) addrs.add(x); }
  const custEmail = (c.customerEmail || c.application?.applicantEmail || '').trim().toLowerCase();
  if (custEmail.includes('@')) addrs.add(custEmail);
  for (const a of addrs) {
    try { msgs.push(...(await fetchMessagesForAddress(a))); }
    catch (e) { console.error('[resolution-email] address fetch failed', caseId, a, e); }
  }

  // Dedupe by Gmail message id before insert (createMany also skips DB duplicates).
  const seen = new Set<string>();
  const uniq = msgs.filter((m) => (seen.has(m.gmailMessageId) ? false : (seen.add(m.gmailMessageId), true)));

  let added = 0;
  if (uniq.length) {
    const res = await prisma.resolutionEmail.createMany({
      data: uniq.map((m) => ({ caseId, gmailMessageId: m.gmailMessageId, fromAddr: m.fromAddr, sentAt: m.sentAt, snippet: m.snippet, inbound: m.inbound })),
      skipDuplicates: true,
    });
    added = res.count;
  }
  await prisma.resolutionCase.update({ where: { id: caseId }, data: { emailSyncedAt: new Date() } });
  return { added };
}

/** Sweep every open case that has a linked thread OR extra watched addresses. */
export async function sweepResolutionEmails(): Promise<{ cases: number; added: number }> {
  if (!gmailResolutionConfigured()) return { cases: 0, added: 0 };
  const cases = await prisma.resolutionCase.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      OR: [{ gmailThreadId: { not: null } }, { watchEmails: { isEmpty: false } }],
    },
    select: { id: true },
  });
  let added = 0;
  for (const c of cases) {
    try {
      const r = await syncCaseEmails(c.id);
      added += r.added;
    } catch (e) {
      console.error('[resolution-email] sync failed for case', c.id, e);
    }
  }
  return { cases: cases.length, added };
}

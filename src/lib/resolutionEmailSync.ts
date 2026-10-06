import 'server-only';
import { prisma } from './db';
import { fetchThreadMessages, gmailResolutionConfigured } from './gmailResolution';
import { OPEN_STATUSES } from './resolutionStatus';

/** Pull new messages from a case's linked Gmail thread into ResolutionEmail. */
export async function syncCaseEmails(caseId: string): Promise<{ added: number }> {
  if (!gmailResolutionConfigured()) return { added: 0 };
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, gmailThreadId: true } });
  if (!c?.gmailThreadId) return { added: 0 };

  const msgs = await fetchThreadMessages(c.gmailThreadId);
  let added = 0;
  if (msgs.length) {
    const res = await prisma.resolutionEmail.createMany({
      data: msgs.map((m) => ({ caseId, gmailMessageId: m.gmailMessageId, fromAddr: m.fromAddr, sentAt: m.sentAt, snippet: m.snippet })),
      skipDuplicates: true,
    });
    added = res.count;
  }
  await prisma.resolutionCase.update({ where: { id: caseId }, data: { emailSyncedAt: new Date() } });
  return { added };
}

/** Sweep every linked, still-open case — driven by the scheduled cron (~30 min). */
export async function sweepResolutionEmails(): Promise<{ cases: number; added: number }> {
  if (!gmailResolutionConfigured()) return { cases: 0, added: 0 };
  const cases = await prisma.resolutionCase.findMany({
    where: { gmailThreadId: { not: null }, status: { in: OPEN_STATUSES } },
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

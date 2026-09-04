import 'server-only';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/constants';
import type { SessionUser } from '@/lib/session';

/**
 * Chat / conversations service. A dealer has one DEAL conversation per deal and
 * one general SUPPORT conversation. Reviewer identities are hidden from dealers
 * at the UI layer (shown as "Reviewer"); this layer records the real author.
 *
 * Phase 1 is polling-backed (the API routes are plain GET/POST); a later SSE +
 * Postgres LISTEN/NOTIFY layer can push the same data without changing callers.
 */

export interface ChatMessageView {
  id: string;
  body: string;
  fromStaff: boolean;
  authorName: string; // already display-safe for the audience (see forDealer)
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  kind: 'DEAL' | 'SUPPORT';
  title: string; // "General support" or the customer name
  subtitle: string | null; // e.g. deal status / dealer name
  applicationId: string | null;
  lastMessageAt: string;
  preview: string | null;
  unread: number;
}

const EPOCH = new Date(0);

/** Can this user read/write the conversation? Dealers are scoped to their dealer. */
export function canAccessConversation(user: SessionUser, conv: { dealerId: string }): boolean {
  if (isInternalRole(user.role)) return true;
  return !!user.dealerId && user.dealerId === conv.dealerId;
}

/** Get (or lazily create) the DEAL conversation for an application. */
export async function getOrCreateDealConversation(applicationId: string): Promise<{ id: string; dealerId: string } | null> {
  const existing = await prisma.conversation.findUnique({ where: { applicationId }, select: { id: true, dealerId: true } });
  if (existing) return existing;
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { dealerId: true } });
  if (!app) return null;
  return prisma.conversation.create({
    data: { dealerId: app.dealerId, kind: 'DEAL', applicationId },
    select: { id: true, dealerId: true },
  });
}

/** Get (or lazily create) the single general SUPPORT conversation for a dealer. */
export async function getOrCreateSupportConversation(dealerId: string): Promise<{ id: string; dealerId: string }> {
  const existing = await prisma.conversation.findFirst({
    where: { dealerId, kind: 'SUPPORT' },
    select: { id: true, dealerId: true },
  });
  if (existing) return existing;
  return prisma.conversation.create({ data: { dealerId, kind: 'SUPPORT' }, select: { id: true, dealerId: true } });
}

/** Post a message; stamps the conversation's lastMessageAt and marks the author caught-up. */
export async function postChatMessage(args: { conversationId: string; user: SessionUser; body: string }): Promise<void> {
  const body = args.body.trim().slice(0, 4000);
  if (!body) return;
  const now = new Date();
  const fromStaff = isInternalRole(args.user.role);
  await prisma.$transaction([
    prisma.chatMessage.create({ data: { conversationId: args.conversationId, authorId: args.user.userId, fromStaff, body } }),
    prisma.conversation.update({ where: { id: args.conversationId }, data: { lastMessageAt: now } }),
    prisma.conversationRead.upsert({
      where: { conversationId_userId: { conversationId: args.conversationId, userId: args.user.userId } },
      create: { conversationId: args.conversationId, userId: args.user.userId, lastReadAt: now },
      update: { lastReadAt: now },
    }),
  ]);
}

/** Mark a conversation read up to now for this user. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const now = new Date();
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** Messages in a conversation, oldest first. Names are anonymised for dealers. */
export async function conversationMessages(conversationId: string, viewer: SessionUser): Promise<ChatMessageView[]> {
  const forDealer = !isInternalRole(viewer.role);
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { name: true } } },
    take: 500,
  });
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    fromStaff: m.fromStaff,
    // A dealer never sees a GWA staff member's name — just "Reviewer".
    authorName: forDealer && m.fromStaff ? 'Reviewer' : m.author?.name ?? 'Unknown',
    createdAt: m.createdAt.toISOString(),
  }));
}

async function unreadCounts(conversationIds: string[], userId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (conversationIds.length === 0) return out;
  const reads = await prisma.conversationRead.findMany({
    where: { userId, conversationId: { in: conversationIds } },
    select: { conversationId: true, lastReadAt: true },
  });
  const lastRead = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));
  await Promise.all(
    conversationIds.map(async (id) => {
      const n = await prisma.chatMessage.count({
        where: { conversationId: id, authorId: { not: userId }, createdAt: { gt: lastRead.get(id) ?? EPOCH } },
      });
      out.set(id, n);
    }),
  );
  return out;
}

function dealTitle(app: { applicantFirstName: string; applicantLastName: string } | null): string {
  return app ? `${app.applicantFirstName} ${app.applicantLastName}`.trim() : 'Deal';
}

/** Dealer-facing conversation list (their dealer only). Ensures General support exists. */
export async function dealerConversationSummaries(dealerId: string, userId: string): Promise<ConversationSummary[]> {
  await getOrCreateSupportConversation(dealerId);
  const convs = await prisma.conversation.findMany({
    where: { dealerId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      application: { select: { id: true, applicantFirstName: true, applicantLastName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true } },
    },
  });
  const unread = await unreadCounts(convs.map((c) => c.id), userId);
  return convs.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.kind === 'SUPPORT' ? 'General support' : dealTitle(c.application),
    subtitle: c.kind === 'DEAL' ? 'Deal' : 'Questions for the GWA team',
    applicationId: c.applicationId,
    lastMessageAt: c.lastMessageAt.toISOString(),
    preview: c.messages[0]?.body.slice(0, 120) ?? null,
    unread: unread.get(c.id) ?? 0,
  }));
}

/** Staff-facing conversation list (all dealers). Only conversations with activity. */
export async function staffConversationSummaries(userId: string, opts?: { search?: string }): Promise<ConversationSummary[]> {
  const search = opts?.search?.trim();
  const convs = await prisma.conversation.findMany({
    where: {
      messages: { some: {} },
      ...(search
        ? {
            OR: [
              { dealer: { name: { contains: search, mode: 'insensitive' } } },
              { application: { applicantLastName: { contains: search, mode: 'insensitive' } } },
              { application: { applicantFirstName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 150,
    include: {
      dealer: { select: { name: true } },
      application: { select: { id: true, applicantFirstName: true, applicantLastName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true } },
    },
  });
  const unread = await unreadCounts(convs.map((c) => c.id), userId);
  return convs.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.kind === 'SUPPORT' ? `${c.dealer.name} — general support` : dealTitle(c.application),
    subtitle: c.kind === 'DEAL' ? c.dealer.name : 'General support',
    applicationId: c.applicationId,
    lastMessageAt: c.lastMessageAt.toISOString(),
    preview: c.messages[0]?.body.slice(0, 120) ?? null,
    unread: unread.get(c.id) ?? 0,
  }));
}

/** Total unread across a user's accessible conversations (for the bubble badge). */
export async function totalUnread(user: SessionUser): Promise<number> {
  // A dealerId (real dealer, or an admin viewing as one) → that dealer's threads;
  // otherwise (reviewer/admin in the staff area) → all active threads.
  const where = user.dealerId ? { dealerId: user.dealerId } : { messages: { some: {} } };
  const convs = await prisma.conversation.findMany({ where, select: { id: true }, take: 300 });
  const unread = await unreadCounts(convs.map((c) => c.id), user.userId);
  let total = 0;
  for (const n of unread.values()) total += n;
  return total;
}

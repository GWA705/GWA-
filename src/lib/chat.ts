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
  auto: boolean; // automated system message (after-hours notice) — render distinctly
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
  // An admin "viewing as" a dealer is acting AS the dealer — their messages are
  // dealer messages, not staff (so the assistant answers and doesn't treat them
  // as a teammate taking over).
  const fromStaff = isInternalRole(args.user.role) && !args.user.impersonating;
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

// GWA support hours are 9am–9pm; a dealer message outside that window gets an
// automated acknowledgement. Bodies are stored in the dealer's language (no
// company name, so no brand-name pitfalls).
export const AFTER_HOURS_REPLY: Record<'en' | 'fr', string> = {
  en: 'Thanks for your message! Our team is offline right now (9 PM–9 AM). Your note is logged and we’ll reply as soon as we’re back.',
  fr: 'Merci pour votre message! Notre équipe est hors ligne en ce moment (21 h à 9 h). Votre note est enregistrée et nous vous répondrons dès notre retour.',
};

/** True when the given time is outside 9am–9pm in America/Toronto. */
export function isAfterHours(date = new Date()): boolean {
  const h =
    Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', hour12: false }).format(date)) % 24;
  return h >= 21 || h < 9;
}

/** Post an automated system message (no human author) and stamp the thread. */
export async function postAutoReply(conversationId: string, body: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId, authorId: null, fromStaff: true, auto: true, body: body.trim().slice(0, 1000) },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
  ]);
}

/**
 * True if an automated reply has already acknowledged the current dealer burst —
 * the latest auto message is newer than the latest human staff reply. Prevents
 * an after-hours notice on every message until a person actually replies.
 */
export async function autoReplyOutstanding(conversationId: string): Promise<boolean> {
  const [lastAuto, lastHuman] = await Promise.all([
    prisma.chatMessage.findFirst({ where: { conversationId, auto: true }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.chatMessage.findFirst({
      where: { conversationId, fromStaff: true, auto: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  if (!lastAuto) return false;
  return !lastHuman || lastAuto.createdAt > lastHuman.createdAt;
}

/** Recent messages as AI turns (dealer = user; staff/auto = assistant), oldest first. */
export async function recentTurnsForAi(conversationId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { body: true, fromStaff: true, auto: true },
    take: 30,
  });
  return rows
    .slice(-14)
    .map((m) => ({ role: (!m.fromStaff && !m.auto ? 'user' : 'assistant') as 'user' | 'assistant', content: m.body }));
}

/** True if a real teammate (not the assistant) replied within the last `minutes`. */
export async function humanRepliedRecently(conversationId: string, minutes = 30): Promise<boolean> {
  const since = new Date(Date.now() - minutes * 60_000);
  const row = await prisma.chatMessage.findFirst({
    where: { conversationId, fromStaff: true, auto: false, createdAt: { gt: since } },
    select: { id: true },
  });
  return !!row;
}

/** Clear a General support thread: delete its messages + read markers, start fresh. */
export async function clearSupportConversation(conversationId: string): Promise<void> {
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { conversationId } }),
    prisma.conversationRead.deleteMany({ where: { conversationId } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
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
    auto: m.auto,
    // Automated/assistant message → "Assistant"; otherwise a dealer never sees a
    // staff member's name — just "Reviewer".
    authorName: m.auto ? 'Assistant' : forDealer && m.fromStaff ? 'Reviewer' : m.author?.name ?? 'Unknown',
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

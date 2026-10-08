import 'server-only';
import { google, type gmail_v1 } from 'googleapis';

/**
 * Read-only Gmail access for the HD Resolution Centre (Phase 3b-2).
 *
 * Reuses the portal's existing Google service account (GOOGLE_SERVICE_ACCOUNT_JSON)
 * with **domain-wide delegation**: a Workspace admin grants the service account
 * the `gmail.readonly` scope, and we impersonate ONE mailbox (GMAIL_RESOLUTION_USER)
 * and only ever read ONE label (GMAIL_RESOLUTION_LABEL, default "HD Resolution").
 *
 * Everything here is INERT until configured — gmailResolutionConfigured() is false
 * and callers show a "not set up" state instead of erroring.
 */

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function gmailResolutionConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GMAIL_RESOLUTION_USER);
}

export function resolutionLabel(): string {
  return (process.env.GMAIL_RESOLUTION_LABEL || 'HD Resolution').trim();
}

let _gmail: gmail_v1.Gmail | null = null;
function gmailClient(): gmail_v1.Gmail {
  if (_gmail) return _gmail;
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const subject = process.env.GMAIL_RESOLUTION_USER;
  if (!inline || !subject) throw new Error('Gmail resolution sync is not configured.');
  const creds = JSON.parse(inline) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
    subject, // domain-wide delegation: impersonate this mailbox, read-only
  });
  _gmail = google.gmail({ version: 'v1', auth });
  return _gmail;
}

/** A pulled message, normalized for storage/display. */
export interface GmailMessage {
  gmailMessageId: string;
  fromAddr: string;
  sentAt: Date | null;
  snippet: string;
  inbound: boolean; // from HD / not us — drives "awaiting our reply"
}

/** Our own mail domain — a message from it is a reply we sent (not awaiting us). */
export function ourMailDomain(): string {
  return (process.env.GMAIL_RESOLUTION_OUR_DOMAIN || 'ghsbarrie.ca').toLowerCase();
}
function isInbound(fromAddr: string): boolean {
  return !fromAddr.toLowerCase().includes(ourMailDomain());
}

/** Pull HD's CASE # out of a subject, e.g. "CASE #08210415 ON …" → "08210415". */
export function parseHdCaseNumber(subject: string): string | null {
  const m = /case\s*#?\s*(\d{5,})/i.exec(subject || '');
  return m ? m[1] : null;
}

export interface HdSubjectParts {
  caseNumber: string | null; // HD resolution CASE #
  hdRef: string | null; // HD customer / LEAD # (the 800… number)
  lastName: string | null; // customer last name
  store: string | null; // HD store number (e.g. "7133")
}

/**
 * Parse everything useful out of an HD resolution subject so a new case can be
 * pre-filled. HD's subjects are highly structured, e.g.:
 *   "CASE #08210415 ON DUPRE 7133 LEAD #800254246 WATER TREATMENT SYSTEM …"
 * → caseNumber 08210415, lastName DUPRE, store 7133, hdRef 800254246.
 * Any part that isn't present comes back null (some subjects omit the name/lead).
 */
export function parseHdSubject(subject: string): HdSubjectParts {
  const s = subject || '';
  // HD customer / LEAD # — always an 800-prefixed 9-digit number (order numbers
  // like 611544165 are NOT 800-prefixed, so they're correctly ignored).
  const hdRef = (/\b(800\d{6})\b/.exec(s) || [])[1] ?? null;
  // "<2-letter code> <LASTNAME> <4-digit store>" — the code is the preposition
  // "ON"/a province code; the name is the token before the store number.
  const nm = /\b(?:ON|AB|BC|SK|MB|QC|NS|NB|NL|PE|NT|NU|YT)\s+([A-Za-z][A-Za-z'’\-]{1,30})\s+(\d{4})\b/i.exec(s);
  return {
    caseNumber: parseHdCaseNumber(s),
    hdRef,
    lastName: nm ? nm[1] : null,
    store: nm ? nm[2] : null,
  };
}

export interface GmailThreadSummary {
  threadId: string;
  subject: string;
  fromAddr: string;
  sentAt: Date | null;
  snippet: string;
}

function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  const h = payload?.headers?.find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}
function parseDate(v: string): Date | null {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}
// A Gmail label name is used in a search query; quote it so spaces work.
function labelQuery(): string {
  return `label:"${resolutionLabel()}"`;
}

/**
 * Find the HD email thread for a reference (HD ref # or case number). Searches
 * the configured label for the ref text and returns the first matching thread.
 */
export async function searchThreadForRef(ref: string): Promise<{ threadId: string; subject: string } | null> {
  const q = `${labelQuery()} "${ref.replace(/"/g, '')}"`;
  const res = await gmailClient().users.messages.list({ userId: 'me', q, maxResults: 5 });
  const msg = res.data.messages?.[0];
  if (!msg?.threadId) return null;
  const meta = await gmailClient().users.messages.get({
    userId: 'me', id: msg.id!, format: 'metadata', metadataHeaders: ['Subject'],
  });
  return { threadId: msg.threadId, subject: header(meta.data.payload, 'Subject') || '(no subject)' };
}

/** All messages in a thread, oldest-first. */
export async function fetchThreadMessages(threadId: string): Promise<GmailMessage[]> {
  const res = await gmailClient().users.threads.get({
    userId: 'me', id: threadId, format: 'metadata', metadataHeaders: ['From', 'Date'],
  });
  const msgs = res.data.messages || [];
  return msgs
    .filter((m) => m.id)
    .map((m) => {
      const fromAddr = header(m.payload, 'From') || '(unknown sender)';
      return {
        gmailMessageId: m.id!,
        fromAddr,
        sentAt: parseDate(header(m.payload, 'Date')),
        snippet: (m.snippet || '').trim(),
        inbound: isInbound(fromAddr),
      };
    });
}

// --- First-message body (for the AI problem summary) -----------------------

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
/** Find the first part of a given MIME type anywhere in the part tree. */
function findPart(part: gmail_v1.Schema$MessagePart, mime: string): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}
function extractBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) return decodeB64Url(plain.body.data);
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) return decodeB64Url(html.body.data).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ');
  if (payload.body?.data) return decodeB64Url(payload.body.data);
  return '';
}

/**
 * The plain-text body of the FIRST message in a thread — what the case is about.
 * Strips quoted reply history and collapses whitespace; falls back to the
 * snippet. Used to feed the AI problem-summary. Null when unavailable.
 */
export async function fetchFirstMessageText(threadId: string): Promise<string | null> {
  const res = await gmailClient().users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  const first = (res.data.messages || [])[0];
  if (!first) return null;
  const raw = extractBodyText(first.payload).trim() || (first.snippet || '').trim();
  if (!raw) return null;
  // Drop quoted history / original-message blocks so the summary focuses on the
  // new content, then collapse blank runs.
  const cut = raw.split(/\n\s*(?:On .+wrote:|-{3,}\s*Original Message|_{10,})/)[0] ?? raw;
  return cut.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000) || null;
}

/**
 * The plain-text body of the LATEST INBOUND message in a thread — HD's most
 * recent email to us (not our own replies). Used to give the AI reply-drafter the
 * message we're responding to. Falls back to the latest message's snippet, then
 * null.
 */
export async function fetchLatestInboundText(threadId: string): Promise<string | null> {
  const res = await gmailClient().users.threads.get({
    userId: 'me', id: threadId, format: 'full',
  });
  const msgs = res.data.messages || [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    const from = header(m.payload, 'From') || '';
    if (!isInbound(from)) continue; // skip our own sent replies
    const raw = extractBodyText(m.payload).trim() || (m.snippet || '').trim();
    if (!raw) return null;
    const cut = raw.split(/\n\s*(?:On .+wrote:|-{3,}\s*Original Message|_{10,})/)[0] ?? raw;
    return cut.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000) || null;
  }
  return null;
}

/**
 * Recent threads under the label, newest-first, excluding any already linked to a
 * case — the "unlinked HD emails" inbox. Best-effort; returns [] if unconfigured.
 */
export async function listUnlinkedThreads(linkedThreadIds: Set<string>, limit = 25): Promise<GmailThreadSummary[]> {
  const res = await gmailClient().users.threads.list({ userId: 'me', q: labelQuery(), maxResults: Math.min(limit * 2, 100) });
  const threads = res.data.threads || [];
  const out: GmailThreadSummary[] = [];
  for (const t of threads) {
    if (!t.id || linkedThreadIds.has(t.id)) continue;
    const full = await gmailClient().users.threads.get({
      userId: 'me', id: t.id, format: 'metadata', metadataHeaders: ['From', 'Date', 'Subject'],
    });
    const msgs = full.data.messages || [];
    const latest = msgs[msgs.length - 1];
    out.push({
      threadId: t.id,
      subject: header(latest?.payload, 'Subject') || '(no subject)',
      fromAddr: header(latest?.payload, 'From') || '(unknown sender)',
      sentAt: parseDate(header(latest?.payload, 'Date')),
      snippet: (t.snippet || latest?.snippet || '').trim(),
    });
    if (out.length >= limit) break;
  }
  return out;
}

import 'server-only';
import { google, type gmail_v1 } from 'googleapis';

/**
 * Shared read-only Gmail client.
 *
 * Reuses the portal's existing Google service account (GOOGLE_SERVICE_ACCOUNT_JSON)
 * with domain-wide delegation, impersonating the HD Resolution mailbox
 * (GMAIL_RESOLUTION_USER) under the `gmail.readonly` scope. That mailbox
 * (sean@ghsbarrie.ca) is also where the FinanceIt deal notifications land, so
 * reading them needs **no new credential or config** beyond what HD Resolution
 * already uses. Inert until configured — callers check gmailReadConfigured().
 */

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function gmailReadConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GMAIL_RESOLUTION_USER);
}

let _gmail: gmail_v1.Gmail | null = null;
export function gmailReadClient(): gmail_v1.Gmail {
  if (_gmail) return _gmail;
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const subject = process.env.GMAIL_RESOLUTION_USER;
  if (!inline || !subject) throw new Error('Read-only Gmail is not configured.');
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

/** Read a header value off a message payload (case-insensitive). */
export function gmailHeader(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  const h = payload?.headers?.find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

export function gmailParseDate(v: string): Date | null {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** First part of a given MIME type anywhere in the part tree. */
function findPart(part: gmail_v1.Schema$MessagePart, mime: string): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

/** Plain-text body of a message (HTML stripped as a fallback). */
export function gmailBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) return decodeB64Url(plain.body.data);
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) return decodeB64Url(html.body.data).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ');
  if (payload.body?.data) return decodeB64Url(payload.body.data);
  return '';
}

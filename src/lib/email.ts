import nodemailer, { type Transporter } from 'nodemailer';
import { getSettings, EMAIL_SETTING_KEYS } from './settings';

/**
 * Provider-agnostic transactional email, sent over SMTP. Works with Google
 * Workspace (smtp.gmail.com / smtp-relay.gmail.com) and any other SMTP provider.
 *
 * Until SMTP credentials are configured, the service runs in LOG-ONLY mode: it
 * records what *would* be sent to the server log and returns without sending, so
 * the app is fully functional and nothing breaks before email is switched on.
 *
 * NEVER put sensitive personal information (SIN, banking, ID) in an email —
 * emails link back to the portal instead.
 */

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function emailEnabled(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Resolve the From/Reply-To identity. Admin-editable DB settings win; each
 * falls back to its environment variable, then a sensible default. The From
 * and Reply-To group addresses can therefore be changed in the admin panel
 * without a redeploy.
 */
async function identity(): Promise<{ from: string; replyTo: string }> {
  const s = await getSettings([
    EMAIL_SETTING_KEYS.fromName,
    EMAIL_SETTING_KEYS.fromEmail,
    EMAIL_SETTING_KEYS.replyTo,
  ]);
  const name = s[EMAIL_SETTING_KEYS.fromName] || process.env.EMAIL_FROM_NAME || 'GWA Dealer Portal';
  const fromEmail =
    s[EMAIL_SETTING_KEYS.fromEmail] || process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@example.com';
  const replyTo = s[EMAIL_SETTING_KEYS.replyTo] || process.env.EMAIL_REPLY_TO || fromEmail;
  return { from: `${name} <${fromEmail}>`, replyTo };
}

let transporter: Transporter | null = null;
function getTransport(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * For the admin UI: the stored (DB) override values (null = using the default)
 * and the effective values actually used when sending.
 */
export async function getEmailIdentityInfo(): Promise<{
  stored: { fromName: string | null; fromEmail: string | null; replyTo: string | null };
  effective: { fromName: string; fromEmail: string; replyTo: string };
}> {
  const s = await getSettings([
    EMAIL_SETTING_KEYS.fromName,
    EMAIL_SETTING_KEYS.fromEmail,
    EMAIL_SETTING_KEYS.replyTo,
  ]);
  const fromName = s[EMAIL_SETTING_KEYS.fromName] || process.env.EMAIL_FROM_NAME || 'GWA Dealer Portal';
  const fromEmail =
    s[EMAIL_SETTING_KEYS.fromEmail] || process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@example.com';
  const replyTo = s[EMAIL_SETTING_KEYS.replyTo] || process.env.EMAIL_REPLY_TO || fromEmail;
  return {
    stored: {
      fromName: s[EMAIL_SETTING_KEYS.fromName],
      fromEmail: s[EMAIL_SETTING_KEYS.fromEmail],
      replyTo: s[EMAIL_SETTING_KEYS.replyTo],
    },
    effective: { fromName, fromEmail, replyTo },
  };
}

export async function sendEmail(
  args: SendEmailArgs,
): Promise<{ sent: boolean; reason?: string; code?: string }> {
  const text = args.text || stripHtml(args.html);

  if (!emailEnabled()) {
    console.log(
      `[email:log-only] would send → to="${args.to}" subject="${args.subject}" preview="${text.slice(0, 120)}"`,
    );
    return { sent: false, reason: 'log-only' };
  }

  try {
    const { from, replyTo } = await identity();
    await getTransport().sendMail({
      from,
      replyTo,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err);
    // Surface the real SMTP error so the admin test can show what went wrong.
    // These messages never contain the password.
    const e = err as { message?: string; code?: string };
    return { sent: false, reason: e?.message || 'error', code: e?.code };
  }
}

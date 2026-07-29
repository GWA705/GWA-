import nodemailer, { type Transporter } from 'nodemailer';

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

function fromAddress(): string {
  const name = process.env.EMAIL_FROM_NAME || 'GWA Dealer Portal';
  const addr = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@example.com';
  return `${name} <${addr}>`;
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

export async function sendEmail(args: SendEmailArgs): Promise<{ sent: boolean; reason?: string }> {
  const text = args.text || stripHtml(args.html);

  if (!emailEnabled()) {
    console.log(
      `[email:log-only] would send → to="${args.to}" subject="${args.subject}" preview="${text.slice(0, 120)}"`,
    );
    return { sent: false, reason: 'log-only' };
  }

  try {
    await getTransport().sendMail({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { sent: false, reason: 'error' };
  }
}

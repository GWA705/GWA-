// Content for an email that sends a customer one or more stored documents
// (brochures / manuals) as attachments — e.g. when they ask for one on the
// confirmation call. Greyscale + logo, matching the review email's brand.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const COMPANY = 'Georgian Water & Air';
const COMPANY_HTML = 'Georgian Water &amp; Air';
const WEB = 'georgianwaterandair.ca';
const EMAIL = 'info@georgianwaterandair.ca';
const TEL_DISPLAY = '1-866-840-2789';
const TEL_LINK = '+18668402789';

function firstName(full: string): string {
  const f = (full || '').trim().split(/\s+/)[0];
  return f || 'there';
}

export function buildDocsEmail(opts: {
  customerName: string;
  message: string; // optional free-text note from the rep
  /** Files included as email attachments. */
  attachedTitles?: string[];
  /** Files too big to attach — offered as secure download links instead. */
  links?: { title: string; url: string }[];
  /** How many days the download links stay valid (for the on-page note). */
  linkTtlDays?: number;
  logoUrl: string;
}): { subject: string; html: string; text: string } {
  const first = escapeHtml(firstName(opts.customerName));
  const subject = `Your requested information — ${COMPANY}`;
  const note = (opts.message || '').trim();
  const attached = opts.attachedTitles ?? [];
  const links = opts.links ?? [];
  const ttl = opts.linkTtlDays ?? 30;
  const noteHtml = note
    ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">${escapeHtml(note).replace(/\n/g, '<br />')}</p>`
    : '';

  // Attached files — a simple bulleted list.
  const attachedHtml = attached.length
    ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#374151;">
          ${attached.length === 1 ? 'The following document is' : 'The following documents are'} attached to this email:
        </p>
        <ul style="margin:0 0 14px;padding-left:20px;font-size:14px;color:#374151;">${attached
          .map((d) => `<li style="margin:2px 0;">${escapeHtml(d)}</li>`)
          .join('')}</ul>`
    : '';

  // Download-link files — rendered as tappable buttons (too big to attach).
  const linksHtml = links.length
    ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#374151;">
          ${links.length === 1 ? 'Your document is' : 'Your documents are'} ready to download${
            attached.length ? ' as well' : ''
          }:
        </p>
        ${links
          .map(
            (l) => `<p style="margin:0 0 8px;">
          <a href="${escapeHtml(l.url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px;font-size:14px;">⬇ ${escapeHtml(l.title)}</a>
        </p>`,
          )
          .join('')}
        <p style="margin:2px 0 14px;font-size:12px;line-height:1.5;color:#9ca3af;">These download links work for ${ttl} days.</p>`
    : '';

  const html = `<!-- ${COMPANY_HTML} documents -->
<div style="background:#f4f4f5;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0"
           style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td align="center" style="padding:22px 16px 8px;">
        <img src="${escapeHtml(opts.logoUrl)}" alt="${COMPANY_HTML} — Authorized Home Depot Installer"
             width="440" height="134"
             style="display:block;width:440px;max-width:92%;height:auto;border:0;outline:none;text-decoration:none;" />
      </td></tr>
      <tr><td style="padding:10px 28px 4px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Hi ${first},</h1>
        ${noteHtml}
        <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#374151;">As requested, here is the information you asked for.</p>
        ${attachedHtml}
        ${linksHtml}
        <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#374151;">
          Questions? Just reply to this email or call us at
          <a href="tel:${TEL_LINK}" style="color:#111827;">${TEL_DISPLAY}</a> — we're happy to help.
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;background:#fafafa;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">${COMPANY_HTML}</p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
          <a href="tel:${TEL_LINK}" style="color:#6b7280;text-decoration:none;">${TEL_DISPLAY}</a> &nbsp;·&nbsp;
          <a href="mailto:${EMAIL}" style="color:#6b7280;text-decoration:none;">${EMAIL}</a> &nbsp;·&nbsp;
          <a href="https://${WEB}" style="color:#6b7280;text-decoration:none;">${WEB}</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</div>`;

  const text = [
    `Hi ${firstName(opts.customerName)},`,
    ``,
    ...(note ? [note, ``] : []),
    `As requested, here is the information you asked for.`,
    ...(attached.length ? [``, `Attached:`, ...attached.map((d) => `  - ${d}`)] : []),
    ...(links.length
      ? [``, `Download (links work for ${ttl} days):`, ...links.map((l) => `  - ${l.title}: ${l.url}`)]
      : []),
    ``,
    `Questions? Reply to this email or call ${TEL_DISPLAY}.`,
    ``,
    `${COMPANY}`,
    `${TEL_DISPLAY} · ${EMAIL} · ${WEB}`,
  ].join('\n');

  return { subject, html, text };
}

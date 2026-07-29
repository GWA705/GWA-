// Branded, inline-styled HTML for transactional emails. Kept deliberately
// simple and free of any sensitive personal information.

const BRAND = '#1d4ed8';

export function renderEmail(opts: {
  heading: string;
  intro: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const appName = process.env.EMAIL_FROM_NAME || 'GWA Dealer Portal';
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<tr><td style="padding:8px 0 4px;">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND};color:#ffffff;
              text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px;font-size:14px;">
             ${escapeHtml(opts.ctaLabel)}
           </a></td></tr>`
      : '';

  return `<!-- ${appName} email -->
<div style="background:#f3f4f6;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;
                    border:1px solid #e5e7eb;">
        <tr><td style="background:${BRAND};padding:16px 24px;color:#ffffff;font-weight:700;font-size:16px;">
          ${escapeHtml(appName)}
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:19px;color:#111827;">${escapeHtml(opts.heading)}</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">${escapeHtml(opts.intro)}</p>
          ${opts.bodyHtml ?? ''}
          <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
          ${opts.footerNote ? `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(opts.footerNote)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:14px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
          This is an automated message from ${escapeHtml(appName)}. Please do not include sensitive
          personal information in any reply.
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

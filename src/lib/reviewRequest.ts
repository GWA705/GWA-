// Content for the post-job "leave us a review" request sent to a customer.
//
// Brand: customer-facing, so it follows docs/BRAND-KIT.md — the display name is
// "Georgian Water & Air" (ampersand), and the look is GREYSCALE + the logo as the
// only visual element (the palette is [TO CONFIRM] in the kit, so we don't guess
// colours). One dark call-to-action button. Web/`tel:` conventions use hyphens.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const COMPANY = 'Georgian Water & Air';
const COMPANY_HTML = 'Georgian Water &amp; Air'; // &-escaped for use in HTML text
const WEB = 'georgianwaterandair.ca';
const EMAIL = 'info@georgianwaterandair.ca';
const TEL_DISPLAY = '1-866-840-2789'; // web convention: hyphens
const TEL_LINK = '+18668402789';

/** First name for a friendly greeting, falling back to a neutral hello. */
function firstName(full: string): string {
  const f = (full || '').trim().split(/\s+/)[0];
  return f || 'there';
}

export function buildReviewEmail(opts: {
  customerName: string;
  reviewLink: string;
  logoUrl: string;
}): { subject: string; html: string; text: string } {
  const first = escapeHtml(firstName(opts.customerName));
  const link = opts.reviewLink;
  const subject = `How did we do? — ${COMPANY}`;

  const html = `<!-- ${COMPANY_HTML} review request -->
<div style="background:#f4f4f5;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td align="center" style="padding:28px 24px 8px;">
          <img src="${escapeHtml(opts.logoUrl)}" alt="${COMPANY_HTML}" width="220"
               style="display:block;width:220px;max-width:70%;height:auto;" />
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 0;">
          <div style="font-size:40px;line-height:1;letter-spacing:4px;color:#111827;" aria-hidden="true">★★★★★</div>
        </td></tr>
        <tr><td style="padding:12px 28px 4px;">
          <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#111827;text-align:center;">
            Hi ${first}, how did we do?
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#374151;text-align:center;">
            Thank you for choosing ${COMPANY_HTML}. If our team took great care of you,
            would you take <strong>30 seconds</strong> to share a quick review? It
            genuinely helps your neighbours find us — and it means the world to our crew.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:6px 28px 8px;">
          <a href="${escapeHtml(link)}"
             style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;
                    font-weight:700;padding:15px 30px;border-radius:10px;font-size:16px;">
            ⭐ Leave a quick review
          </a>
        </td></tr>
        <tr><td align="center" style="padding:4px 28px 22px;">
          <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
            If the button doesn't work, copy and paste this link:<br />
            <a href="${escapeHtml(link)}" style="color:#6b7280;">${escapeHtml(link)}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;background:#fafafa;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">${COMPANY_HTML}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
            <a href="tel:${TEL_LINK}" style="color:#6b7280;text-decoration:none;">${TEL_DISPLAY}</a> &nbsp;·&nbsp;
            <a href="mailto:${EMAIL}" style="color:#6b7280;text-decoration:none;">${EMAIL}</a> &nbsp;·&nbsp;
            <a href="https://${WEB}" style="color:#6b7280;text-decoration:none;">${WEB}</a>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">
            You're receiving this because you recently had work completed by ${COMPANY_HTML}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  const text = [
    `Hi ${firstName(opts.customerName)}, how did we do?`,
    ``,
    `Thank you for choosing ${COMPANY}. If our team took great care of you, would you take 30 seconds to leave a quick review? It really helps.`,
    ``,
    `Leave a review: ${link}`,
    ``,
    `${COMPANY}`,
    `${TEL_DISPLAY} · ${EMAIL} · ${WEB}`,
  ].join('\n');

  return { subject, html, text };
}

/**
 * The text-message version — short, friendly, with the link and a STOP opt-out
 * (required for compliant business texting).
 */
export function buildReviewSms(opts: { customerName: string; reviewLink: string }): string {
  const first = firstName(opts.customerName);
  return `Hi ${first}, thanks for choosing ${COMPANY}! If you had a great experience, we'd love a quick review: ${opts.reviewLink}  Reply STOP to opt out.`;
}

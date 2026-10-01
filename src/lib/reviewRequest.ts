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
  /** Full product names sold (not abbreviations), e.g. "Reverse Osmosis System". */
  products?: string;
  /** The rep/salesperson who sold it, shown in the thank-you line. */
  repName?: string;
}): { subject: string; html: string; text: string } {
  const first = escapeHtml(firstName(opts.customerName));
  const link = opts.reviewLink;
  const subject = `How did we do? — Home Depot Home Services`;

  const prod = (opts.products ?? '').trim();
  const rep = (opts.repName ?? '').trim();
  const productPhraseHtml = prod ? ` for your new ${escapeHtml(prod)}` : '';
  const productPhraseText = prod ? ` for your new ${prod}` : '';
  const thanksClauseHtml = rep
    ? `${escapeHtml(rep)} and the rest of our team appreciate your trust, and we hope you&rsquo;re enjoying your new purchase.`
    : `Our team appreciates your trust, and we hope you&rsquo;re enjoying your new purchase.`;
  const thanksClauseText = rep
    ? `${rep} and the rest of our team appreciate your trust, and we hope you're enjoying your new purchase.`
    : `Our team appreciates your trust, and we hope you're enjoying your new purchase.`;

  const html = `<!-- ${COMPANY_HTML} review request -->
<div style="background:#f4f4f5;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td align="center" style="padding:22px 16px 8px;">
          <!-- width+height attributes so Outlook (which ignores max-width) sizes it;
               the inline style scales it down responsively on phones. -->
          <img src="${escapeHtml(opts.logoUrl)}" alt="Georgian Water &amp; Air — Authorized Home Depot Installer"
               width="440" height="195"
               style="display:block;width:440px;max-width:92%;height:auto;border:0;outline:none;text-decoration:none;" />
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 0;">
          <div style="font-size:40px;line-height:1;letter-spacing:4px;color:#fbbc04;" aria-hidden="true">★★★★★</div>
        </td></tr>
        <tr><td style="padding:12px 28px 4px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111827;text-align:center;">
            Hi ${first}!
          </h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;text-align:center;">
            Thank you for choosing <strong>Home Depot Home Services</strong> and <strong>${COMPANY_HTML}</strong>${productPhraseHtml}.
            ${thanksClauseHtml}
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#374151;text-align:center;">
            Would you take a moment to tell us how we did? We&rsquo;d love to hear about your
            experience &mdash; your feedback means a lot to our team.
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
            You're receiving this because you recently had work completed by Home Depot Home Services and ${COMPANY_HTML}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  const text = [
    `Hi ${firstName(opts.customerName)}!`,
    ``,
    `Thank you for choosing Home Depot Home Services and ${COMPANY}${productPhraseText}. ${thanksClauseText}`,
    ``,
    `Would you take a moment to tell us how we did? We'd love to hear about your experience — your feedback means a lot to our team.`,
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

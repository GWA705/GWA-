// Pure, dependency-free HTML builders for the Home Depot ID-tag onboarding
// emails. Table-based + inline CSS so they render in Gmail/Outlook/Apple Mail.
// Brand: navy hero band + the co-branded logo. Display name is always
// "Georgian Water & Air" (brand kit).

export function escHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Turn an admin's plain-text body (with {{name}}/{{link}}/{{login}}/{{password}}
 *  tokens and blank-line paragraphs) into safe HTML paragraphs. */
export function bodyFromTemplate(
  template: string,
  vars: { name?: string; link?: string; login?: string; password?: string },
): string {
  let t = template;
  t = t.replace(/\{\{\s*name\s*\}\}/gi, vars.name || '');
  t = t.replace(/\{\{\s*link\s*\}\}/gi, vars.link || '');
  t = t.replace(/\{\{\s*login\s*\}\}/gi, vars.login || '');
  t = t.replace(/\{\{\s*password\s*\}\}/gi, vars.password || '');
  return t
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;">${escHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function shell(appUrl: string, heroTitle: string, bodyHtml: string): string {
  const logo = `${appUrl}/gwa-hd-partners.png`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef2f7;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td align="center" style="padding:26px 24px 18px;">
          <img src="${logo}" alt="Georgian Water &amp; Air — Authorized Home Depot Home Services Installer" width="300" style="display:block;width:300px;max-width:86%;height:auto;border:0;">
        </td></tr>
        <tr><td style="background:#1e3a8a;padding:20px 28px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:22px;font-weight:800;">${heroTitle}</div>
        </td></tr>
        <tr><td style="padding:30px 32px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="background:#0f172a;padding:22px 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;">
          <div style="color:#ffffff;font-weight:700;font-size:14px;">Georgian Water &amp; Air</div>
          <div>Authorized Home Depot Home Services Installer</div>
          <div style="margin-top:8px;">Questions? Just reply to this email.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const credRow = (label: string, value: string) => `<tr>
  <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${label}</td>
  <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${value}</td>
</tr>`;

export interface NewRepEmailArgs {
  appUrl: string; firstName: string; link: string; login: string; password: string; customBody?: string | null;
}

/** New rep — background-check setup email (Entuitive). */
export function newRepEmailHtml(a: NewRepEmailArgs): string {
  const first = escHtml(a.firstName || 'there');
  const link = escHtml(a.link);
  const login = escHtml(a.login);
  const password = escHtml(a.password);
  let body: string;
  if (a.customBody && a.customBody.trim()) {
    body = bodyFromTemplate(a.customBody, { name: a.firstName, link: a.link, login: a.login, password: a.password });
  } else {
    body = `
      <p style="margin:0 0 14px;">Hi ${first},</p>
      <p style="margin:0 0 16px;">Welcome to the <strong>Georgian Water &amp; Air</strong> &amp; Home Depot Home Services team! To get your Home Depot ID tag, the next step is to complete your <strong>background screening</strong>.</p>
      <p style="margin:0 0 10px;">Open the <strong>Home Depot background-screening portal (Entuitive)</strong> at the link below and sign in with the credentials here. (These are only for the screening portal — not for the Georgian Water &amp; Air dealer portal.)</p>
      <p style="margin:0 0 14px;"><a href="${link || '#'}" style="color:#1d4ed8;font-weight:700;">${link || '[screening link]'}</a></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px;">
        ${credRow('Entuitive login', login || '[your email]')}
        ${credRow('Entuitive password', password || '[provided separately]')}
      </table>
      <p style="margin:0 0 14px;">Click the <strong>question mark</strong> beside “background screening” and follow the prompts. Once you’ve completed it, let us know so we can send your ID tag.</p>
      <p style="margin:16px 0 0;">Welcome aboard!</p>`;
  }
  return shell(a.appUrl, 'Your Home Depot ID tag — next step', body);
}

export interface TrainingInviteEmailArgs {
  appUrl: string; firstName: string; link: string; office: string;
}

/** New rep — "complete your Home Depot in-store training" invite (sent before
 *  screening). Guides them to the training link; once they pass, they move into
 *  the ID-tag queue automatically. */
export function trainingInviteEmailHtml(a: TrainingInviteEmailArgs): string {
  const first = escHtml(a.firstName || 'there');
  const link = escHtml(a.link);
  const office = escHtml(a.office || 'your office');
  const body = `
    <p style="margin:0 0 14px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Welcome to the <strong>Georgian Water &amp; Air</strong> &amp; Home Depot Home Services team! Before we can set up your Home Depot ID badge, the first step is to complete the <strong>Home Depot in-store training</strong> for ${office}.</p>
    <p style="margin:0 0 10px;">It takes about 20 minutes. Open the link below, work through it, and finish the short quiz &amp; sign-off:</p>
    <p style="margin:0 0 18px;"><a href="${link || '#'}" style="display:inline-block;background:#f96302;color:#ffffff;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:8px;">Start the Home Depot training</a></p>
    <p style="margin:0 0 14px;font-size:13px;color:#64748b;">Or paste this into your browser:<br><span style="word-break:break-all;">${link || '[training link]'}</span></p>
    <p style="margin:0 0 14px;">As soon as you pass, you’re cleared for the next step and we’ll email you your background-screening details.</p>
    <p style="margin:16px 0 0;">Welcome aboard!</p>`;
  return shell(a.appUrl, 'Your first step — Home Depot training', body);
}

export interface ExistingRepEmailArgs {
  appUrl: string; firstName: string; office: string; customBody?: string | null;
}

/** Existing-tag rep — welcome/confirmation (NO background-check steps). */
export function existingRepEmailHtml(a: ExistingRepEmailArgs): string {
  const first = escHtml(a.firstName || 'there');
  const office = escHtml(a.office || 'your office');
  let body: string;
  if (a.customBody && a.customBody.trim()) {
    body = bodyFromTemplate(a.customBody, { name: a.firstName });
  } else {
    body = `
      <p style="margin:0 0 14px;">Hi ${first},</p>
      <p style="margin:0 0 16px;">Welcome to the <strong>Georgian Water &amp; Air</strong> &amp; Home Depot Home Services team! Our records show you already have a Home Depot ID tag, so you’re all set on the screening side — no background check needed.</p>
      <p style="margin:0 0 16px;">You’ve been added to ${office}’s roster. If your Lead Generator training isn’t done yet, please complete it so your file is up to date — your office can send you the link.</p>
      <p style="margin:16px 0 0;">Glad to have you on the team!</p>`;
  }
  return shell(a.appUrl, 'Welcome to the team', body);
}

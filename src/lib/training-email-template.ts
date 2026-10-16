// Pure, dependency-free HTML builders for the Lead Gen Training emails. Table-
// based layout + inline CSS so they render reliably in Gmail / Outlook / Apple
// Mail. Brand: navy header band + neutral body, the approved co-branded logo as
// the hero. Display name is always "Georgian Water & Air" (brand kit).

export function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function shell(appUrl: string, heroHtml: string, bodyHtml: string): string {
  const logo = `${appUrl}/gwa-hd-partners.png`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef2f7;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td align="center" style="padding:26px 24px 18px;">
          <img src="${logo}" alt="Georgian Water &amp; Air — Authorized Home Depot Home Services Installer" width="280" style="display:block;width:280px;max-width:82%;height:auto;border:0;">
        </td></tr>
        <tr><td style="background:#1e3a8a;padding:22px 28px;text-align:center;">${heroHtml}</td></tr>
        <tr><td style="padding:30px 32px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="background:#0f172a;padding:22px 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;">
          <div style="color:#ffffff;font-weight:700;font-size:14px;">Georgian Water &amp; Air</div>
          <div>Authorized Home Depot Home Services Installer</div>
          <div style="margin-top:8px;">This message confirms your in-store training. Questions? Just reply to this email.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function resultCard(rows: { label: string; value: string }[]): string {
  const cells = rows.map((r, i) => {
    const border = i < rows.length - 1 ? 'border-bottom:1px solid #eef2f7;' : '';
    return `<tr>
      <td style="padding:12px 16px;${border}color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${r.label}</td>
      <td style="padding:12px 16px;${border}text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${r.value}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:6px 0;">${cells}</table>`;
}

const passedPill = `<span style="background:#dcfce7;color:#15803d;font-weight:700;font-size:12px;padding:3px 10px;border-radius:999px;">Passed</span>`;
const strong = (s: string) => `<strong style="color:#0f172a;">${s}</strong>`;

export interface TraineeEmailArgs {
  appUrl: string; firstName: string; office: string; score: number; passed: boolean; passThreshold: number; date: string;
}

export function traineeEmailHtml(a: TraineeEmailArgs): string {
  const first = escHtml(a.firstName || 'there');
  const office = escHtml(a.office || 'your office');
  if (a.passed) {
    const hero = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#bfdbfe;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Certificate of Completion</div>
      <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:24px;font-weight:800;margin-top:6px;">You're certified! &#127881;</div>`;
    const body = `
      <p style="margin:0 0 14px;">Hi ${first},</p>
      <p style="margin:0 0 18px;">Congratulations — you've <strong>successfully completed</strong> the Home Depot in-store Lead Generator Training with ${strong(office)}. You're ready to represent Georgian Water &amp; Air on the floor.</p>
      ${resultCard([
        { label: 'Result', value: passedPill },
        { label: 'Score', value: strong(`${a.score}%`) },
        { label: 'Office', value: office },
        { label: 'Date completed', value: a.date },
      ])}
      <p style="margin:18px 0 0;">A copy of your certificate is on file with your office. On every shift, remember: ${strong('steel-toe boots, your Home Depot badge, and your apron')} — and no phones on the floor.</p>
      <p style="margin:16px 0 0;">Welcome to the team!</p>`;
    return shell(a.appUrl, hero, body);
  }
  const hero = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#bfdbfe;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Training Result</div>
    <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:24px;font-weight:800;margin-top:6px;">Almost there</div>`;
  const body = `
    <p style="margin:0 0 14px;">Hi ${first},</p>
    <p style="margin:0 0 18px;">Thanks for taking the Home Depot in-store training with ${strong(office)}. You scored <strong>${a.score}%</strong>, and you need ${a.passThreshold}% to pass — so you're not quite certified yet.</p>
    <p style="margin:0 0 18px;">No problem at all: you can <strong>retake it anytime</strong> using your office's training link. Review the sections (dress code, signing in, the pitch, and answering customer questions) and give it another go — most people pass on the next try.</p>
    <p style="margin:16px 0 0;">You've got this!</p>`;
  return shell(a.appUrl, hero, body);
}

export interface OfficeEmailArgs {
  appUrl: string; traineeName: string; office: string; score: number; passed: boolean; link: string; date: string;
}

export function officeEmailHtml(a: OfficeEmailArgs): string {
  const name = escHtml(a.traineeName || 'A lead generator');
  const hero = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#bfdbfe;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Training Completed</div>
    <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:22px;font-weight:800;margin-top:6px;">${name} finished the training</div>`;
  const statusPill = a.passed
    ? passedPill
    : `<span style="background:#fef9c3;color:#a16207;font-weight:700;font-size:12px;padding:3px 10px;border-radius:999px;">Incomplete</span>`;
  const body = `
    <p style="margin:0 0 18px;">A lead generator has completed the Home Depot in-store Lead Generator Training.</p>
    ${resultCard([
      { label: 'Trainee', value: strong(name) },
      { label: 'Result', value: statusPill },
      { label: 'Score', value: strong(`${a.score}%`) },
      { label: 'Date', value: a.date },
    ])}
    <p style="margin:18px 0 16px;">The full record — answers, rules acknowledged, typed signature, IP &amp; time — is saved for Home Depot compliance.</p>
    <p style="margin:0 0 6px;">
      <a href="${a.link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">Open the certificate record &#8594;</a>
    </p>
    <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">You're receiving this because you're a user on this office's portal account.</p>`;
  return shell(a.appUrl, hero, body);
}

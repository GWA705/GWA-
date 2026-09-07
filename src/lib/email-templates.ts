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

/**
 * Bilingual new-user invite email (login details), shared by the admin add-user
 * flow and the access-request approval flow so there's one source of truth.
 */
export function buildInviteEmail(
  lang: 'en' | 'fr',
  p: { name: string; email: string; portalUrl: string; password: string },
): { subject: string; html: string } {
  const t =
    lang === 'fr'
      ? {
          subject: 'Votre compte du portail des marchands Georgian Water & Air',
          heading: 'Votre compte est prêt',
          intro: `Bonjour ${p.name}, un compte a été créé pour vous dans le portail des marchands de Georgian Water & Air. Utilisez les renseignements ci-dessous pour vous connecter — on vous demandera de choisir votre propre mot de passe lors de la première connexion.`,
          webAddr: 'Adresse Web',
          username: "Nom d'utilisateur",
          tempPw: 'Mot de passe temporaire',
          cta: 'Se connecter au portail',
          footer:
            "Pour votre sécurité, vous devrez choisir un nouveau mot de passe lors de votre première connexion. Si vous n'attendiez pas ce compte, veuillez ignorer ce courriel.",
        }
      : {
          subject: 'Your Georgian Water & Air Dealer Portal account',
          heading: 'Your account is ready',
          intro: `Hi ${p.name}, an account has been created for you on the Georgian Water & Air Dealer Portal. Use the details below to sign in — you'll be asked to set your own password the first time.`,
          webAddr: 'Web address',
          username: 'Username',
          tempPw: 'Temporary password',
          cta: 'Sign in to the portal',
          footer:
            'For your security, you will be required to choose a new password when you first sign in. If you did not expect this account, please ignore this email.',
        };
  const html = renderEmail({
    heading: t.heading,
    intro: t.intro,
    bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;font-size:14px;color:#111827;">
        <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">${t.webAddr}</td><td style="padding:3px 0;"><a href="${p.portalUrl}" style="color:#1d4ed8;">${p.portalUrl}</a></td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">${t.username}</td><td style="padding:3px 0;font-weight:600;">${escapeHtml(p.email)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#6b7280;">${t.tempPw}</td><td style="padding:3px 0;font-family:monospace;font-weight:600;">${escapeHtml(p.password)}</td></tr>
      </table>`,
    ctaLabel: t.cta,
    ctaUrl: p.portalUrl,
    footerNote: t.footer,
  });
  return { subject: t.subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

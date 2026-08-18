import 'server-only';
import { headers } from 'next/headers';
import { prisma } from './db';
import { sendEmail } from './email';
import { sendPushToUser } from './push';

// The source IP of the current request (same extraction the audit log uses).
function currentIp(): string | null {
  try {
    const h = headers();
    return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string));
}

/**
 * Security alert (assessment item R6): if this login comes from an IP the user
 * has never signed in from before, notify them by email + push so an account
 * takeover is caught quickly. The very first successful login isn't flagged
 * (there's no history to compare against). Best-effort — it must never block or
 * break the login, so every failure is swallowed.
 *
 * Call this BEFORE writing the current LOGIN_SUCCESS audit entry, so the history
 * it compares against is prior logins only.
 */
export async function alertOnNewSignIn(user: { id: string; email: string; name: string | null }): Promise<void> {
  try {
    const ip = currentIp();
    if (!ip) return; // can't determine location — don't guess

    const prior = await prisma.auditLog.findMany({
      where: { actorId: user.id, action: 'LOGIN_SUCCESS' },
      select: { ipAddress: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (prior.length === 0) return; // first successful login — nothing to compare

    const known = new Set(prior.map((p) => (p.ipAddress || '').trim()).filter(Boolean));
    if (known.has(ip)) return; // a place they've signed in from before — normal

    const when = new Date().toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

    await sendPushToUser(user.id, {
      title: 'New sign-in to your GWA account',
      body: `From a new location (${ip}). If this wasn't you, change your password.`,
      url: '/account',
      tag: 'signin-alert',
    });

    await sendEmail({
      to: user.email,
      subject: 'New sign-in to your GWA Dealer Portal account',
      html: `<p>Hi ${escapeHtml(user.name || 'there')},</p>
<p>Your GWA Dealer Portal account was just signed in from a location we haven't seen before:</p>
<ul>
  <li><strong>When:</strong> ${escapeHtml(when)}</li>
  <li><strong>IP address:</strong> ${escapeHtml(ip)}</li>
</ul>
<p>If this was you, no action is needed. <strong>If it wasn't you</strong>, please
<a href="https://portal.ghsbarrie.ca/change-password">change your password</a> right away and let the GWA office know.</p>
<p style="color:#6b7280;font-size:12px">Location is approximate (based on the internet address). You can review recent sign-ins any time under “My account”.</p>`,
    });
  } catch (err) {
    console.error('[signinAlert] failed', err);
  }
}

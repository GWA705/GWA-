import 'server-only';
import { sendEmail } from './email';
import { getIdTagSettings } from './settings';
import { newRepEmailHtml, existingRepEmailHtml, trainingInviteEmailHtml } from './idTag-email-template';

function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}
function firstNameOf(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/**
 * New rep — background-check setup email (the Entuitive screening link + shared
 * login/password, all from editable settings). Best-effort; never throws.
 */
export async function sendIdTagNewRepEmail(
  to: string,
  personName: string,
  opts?: { password?: string | null },
): Promise<boolean> {
  if (!to) return false;
  try {
    const s = await getIdTagSettings();
    // The office's standardized password (passed in by the caller) wins; the
    // global screening password is the fallback when an office hasn't set one.
    const password = (opts?.password || '').trim() || s.screeningPassword || '';
    const html = newRepEmailHtml({
      appUrl: appUrl(),
      firstName: firstNameOf(personName),
      link: s.screeningLink || '',
      login: s.screeningLogin || 'your email address',
      password,
      customBody: s.newEmailBody,
    });
    const res = await sendEmail({
      to,
      subject: 'Your Home Depot ID tag — next step (background screening)',
      html,
    });
    return res.sent;
  } catch (e) {
    console.error('[idTag] new-rep email failed', e);
    return false;
  }
}

/**
 * New rep — "complete your Home Depot in-store training" invite. The dealer
 * sends this from their ID-tags list so the person can start training without a
 * portal login. Best-effort; never throws.
 */
export async function sendIdTagTrainingInviteEmail(to: string, personName: string, link: string, office: string): Promise<boolean> {
  if (!to || !link) return false;
  try {
    const html = trainingInviteEmailHtml({ appUrl: appUrl(), firstName: firstNameOf(personName), link, office });
    const res = await sendEmail({
      to,
      subject: 'Your first step — Home Depot in-store training',
      html,
    });
    return res.sent;
  } catch (e) {
    console.error('[idTag] training-invite email failed', e);
    return false;
  }
}

/**
 * Existing-tag rep — welcome/confirmation email (NO background-check steps).
 * Best-effort; never throws.
 */
export async function sendIdTagExistingRepEmail(to: string, personName: string, office: string): Promise<boolean> {
  if (!to) return false;
  try {
    const s = await getIdTagSettings();
    const html = existingRepEmailHtml({
      appUrl: appUrl(),
      firstName: firstNameOf(personName),
      office,
      customBody: s.existingEmailBody,
    });
    const res = await sendEmail({
      to,
      subject: 'Welcome to the Georgian Water & Air team',
      html,
    });
    return res.sent;
  } catch (e) {
    console.error('[idTag] existing-rep email failed', e);
    return false;
  }
}

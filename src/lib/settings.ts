import { prisma } from './db';

/**
 * Admin-editable app settings (key/value in the DB). Used for things an admin
 * should be able to change without a redeploy — e.g. the email From/Reply-To
 * group addresses. SMTP credentials stay in environment variables, not here.
 *
 * A short in-process cache avoids a DB hit on every email; it's invalidated
 * whenever a setting is saved.
 */
export const EMAIL_SETTING_KEYS = {
  fromName: 'email.fromName',
  fromEmail: 'email.fromEmail',
  replyTo: 'email.replyTo',
} as const;

// Whether each dealer-banner slot rotates as a slideshow when it holds more
// than one active banner. Stored as 'true'/'false'; unset defaults to on.
export const BANNER_SETTING_KEYS = {
  rotateTop: 'banner.rotateTop',
  rotateBottom: 'banner.rotateBottom',
} as const;

// Who must have two-factor authentication. 'everyone' (default) requires it for
// all users; 'staff' only reviewers/admins; 'off' makes it optional.
export const SECURITY_SETTING_KEYS = {
  mfaRequirement: 'security.mfaRequirement',
} as const;

export type MfaRequirement = 'everyone' | 'staff' | 'off';

// Where marketplace order emails go. When unset, orders email all admins.
export const MARKETPLACE_SETTING_KEYS = {
  orderEmail: 'marketplace.orderEmail',
} as const;

export async function getMfaRequirement(): Promise<MfaRequirement> {
  const v = await getSetting(SECURITY_SETTING_KEYS.mfaRequirement);
  return v === 'staff' || v === 'off' ? v : 'everyone';
}

/** Whether a given role must enroll a second factor under the current policy. */
export function mfaRequiredForRole(role: string, requirement: MfaRequirement): boolean {
  if (requirement === 'off') return false;
  if (requirement === 'staff') return role !== 'DEALER_USER';
  return true;
}

/** Read the two banner-rotation toggles (default on when unset). */
export async function getBannerRotation(): Promise<{ top: boolean; bottom: boolean }> {
  const s = await getSettings([BANNER_SETTING_KEYS.rotateTop, BANNER_SETTING_KEYS.rotateBottom]);
  return {
    top: s[BANNER_SETTING_KEYS.rotateTop] !== 'false',
    bottom: s[BANNER_SETTING_KEYS.rotateBottom] !== 'false',
  };
}

let cache: Record<string, string> | null = null;

async function loadAll(): Promise<Record<string, string>> {
  if (cache) return cache;
  const rows = await prisma.appSetting.findMany();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return cache;
}

export async function getSetting(key: string): Promise<string | null> {
  const all = await loadAll();
  const v = all[key];
  return v && v.trim() ? v.trim() : null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const all = await loadAll();
  return Object.fromEntries(keys.map((k) => [k, all[k]?.trim() || null]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  const v = value.trim();
  if (v) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: v },
      update: { value: v },
    });
  } else {
    // Empty value clears the override (falls back to env default).
    await prisma.appSetting.deleteMany({ where: { key } });
  }
  cache = null;
}

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

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
  mfaTrustDays: 'security.mfaTrustDays',
} as const;

export type MfaRequirement = 'everyone' | 'staff' | 'off';

// How long a device stays "trusted" after a successful 2FA before the user is
// prompted for a code again. 0 = every login (no remembering). Default 7 days.
export const MFA_TRUST_DAY_OPTIONS = [0, 1, 3, 7, 14, 30] as const;
export const DEFAULT_MFA_TRUST_DAYS = 7;

export async function getMfaTrustDays(): Promise<number> {
  const v = await getSetting(SECURITY_SETTING_KEYS.mfaTrustDays);
  if (v === null) return DEFAULT_MFA_TRUST_DAYS;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MFA_TRUST_DAYS;
  return Math.min(n, 90);
}

// Where marketplace order emails go. When unset, orders email all admins.
export const MARKETPLACE_SETTING_KEYS = {
  orderEmail: 'marketplace.orderEmail',
  // "New Arrivals" auto-rotation (see src/lib/marketplaceSpotlight.ts).
  spotlightEnabled: 'marketplace.spotlight.enabled',
  spotlightCount: 'marketplace.spotlight.count',
  spotlightFreshDays: 'marketplace.spotlight.freshDays',
} as const;

// The "leave us a review" destination the customer review request links to
// (e.g. a Google-review landing page). Admin-editable; the review-request
// feature stays dormant until this is set.
export const REVIEW_SETTING_KEYS = {
  link: 'review.link',
} as const;

/** The customer review link, or null when an admin hasn't set one yet. */
export async function getReviewLink(): Promise<string | null> {
  return getSetting(REVIEW_SETTING_KEYS.link);
}

// Home Depot ID-tag onboarding. Admin-editable so the exact wording, the
// background-screening portal link, and its shared login/password can be
// managed without a redeploy (and the password stays OUT of the codebase/git).
export const ID_TAG_SETTING_KEYS = {
  screeningLink: 'idTag.screeningLink',     // e.g. https://hdis.entuitivetracker.com/
  screeningLogin: 'idTag.screeningLogin',   // the shared login hint (often "your email")
  screeningPassword: 'idTag.screeningPassword', // the shared password for the screening portal
  newEmailBody: 'idTag.newEmailBody',       // background-check setup email (new reps)
  existingEmailBody: 'idTag.existingEmailBody', // welcome email (reps who already have a tag)
  billingRecipients: 'idTag.billingRecipients', // who the monthly ID-tag billing list goes to
  inboxEmail: 'idTag.inboxEmail',               // dedicated inbox new ID-tag requests are copied to
} as const;

/** The dedicated inbox that new ID-tag requests are copied to (editable). */
export const DEFAULT_ID_TAG_INBOX_EMAIL = 'HDIDTags@ghsbarrie.ca';
export async function getIdTagInboxEmail(): Promise<string> {
  return (await getSetting(ID_TAG_SETTING_KEYS.inboxEmail)) || DEFAULT_ID_TAG_INBOX_EMAIL;
}

// The weekly/monthly dealer-snapshot "What's new" announcement (flyer). One
// global announcement that rides on the next sends until cleared. The image is
// stored in S3 (imageKey) and served publicly so email clients can load it.
export const DIGEST_FLYER_KEY = 'digest.flyer';

export interface DigestFlyer {
  title: string;
  blurb: string;
  buttonLabel: string;
  buttonUrl: string;
  imageKey: string | null;
}

/** The current snapshot flyer, or null when nothing is set to show. */
export async function getDigestFlyer(): Promise<DigestFlyer | null> {
  const raw = await getSetting(DIGEST_FLYER_KEY);
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Partial<DigestFlyer>;
    const flyer: DigestFlyer = {
      title: (f.title || '').trim(),
      blurb: (f.blurb || '').trim(),
      buttonLabel: (f.buttonLabel || '').trim(),
      buttonUrl: (f.buttonUrl || '').trim(),
      imageKey: (f.imageKey || '').trim() || null,
    };
    if (!flyer.title && !flyer.blurb && !flyer.imageKey) return null;
    return flyer;
  } catch {
    return null;
  }
}

export async function setDigestFlyer(flyer: DigestFlyer | null): Promise<void> {
  await setSetting(DIGEST_FLYER_KEY, flyer ? JSON.stringify(flyer) : '');
}

/** The background-screening (Entuitive) portal the new-rep email links to, used
 *  when an admin hasn't set an override. Editable in Admin → ID tags. */
export const DEFAULT_ID_TAG_SCREENING_LINK = 'https://hdis.entuitivetracker.com';

/** Default recipients for the monthly ID-tag billing/activation list (editable
 *  in Staff → ID tags). */
export const DEFAULT_ID_TAG_BILLING_RECIPIENTS = ['vanita@ghsbarrie.ca', 'info@ghsbarrie.ca', 'Mona@respiraide.com'];

/** The monthly billing-list recipients — the saved override, or the defaults. */
export async function getIdTagBillingRecipients(): Promise<string[]> {
  const raw = await getSetting(ID_TAG_SETTING_KEYS.billingRecipients);
  if (!raw) return [...DEFAULT_ID_TAG_BILLING_RECIPIENTS];
  const list = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [...DEFAULT_ID_TAG_BILLING_RECIPIENTS];
}

export interface IdTagSettings {
  screeningLink: string | null;
  screeningLogin: string | null;
  screeningPassword: string | null;
  newEmailBody: string | null;
  existingEmailBody: string | null;
}

/** All ID-tag onboarding settings in one read. */
export async function getIdTagSettings(): Promise<IdTagSettings> {
  const m = await getSettings([
    ID_TAG_SETTING_KEYS.screeningLink,
    ID_TAG_SETTING_KEYS.screeningLogin,
    ID_TAG_SETTING_KEYS.screeningPassword,
    ID_TAG_SETTING_KEYS.newEmailBody,
    ID_TAG_SETTING_KEYS.existingEmailBody,
  ]);
  return {
    screeningLink: m[ID_TAG_SETTING_KEYS.screeningLink] || DEFAULT_ID_TAG_SCREENING_LINK,
    screeningLogin: m[ID_TAG_SETTING_KEYS.screeningLogin],
    screeningPassword: m[ID_TAG_SETTING_KEYS.screeningPassword],
    newEmailBody: m[ID_TAG_SETTING_KEYS.newEmailBody],
    existingEmailBody: m[ID_TAG_SETTING_KEYS.existingEmailBody],
  };
}

// Admin-editable knowledge the AI support assistant answers from (FAQ, process,
// policies, tone — written in the team's own words). Injected into the system
// prompt on every reply; edit it to "train" the assistant without a deploy.
// General always applies; the per-area knowledge is added on top based on where
// the dealer is chatting from (Marketplace vs a Deal, etc.). The general key is
// the original `ai.assistantKnowledge` so existing content carries over.
export const AI_SETTING_KEYS = {
  assistantKnowledge: 'ai.assistantKnowledge', // = General
  knowledgeMarketplace: 'ai.knowledge.marketplace',
  knowledgeDeals: 'ai.knowledge.deals',
  knowledgeLeads: 'ai.knowledge.leads',
  knowledgeGiftCards: 'ai.knowledge.giftcards',
  knowledgeProducts: 'ai.knowledge.products',
} as const;

export type AssistantArea = 'general' | 'marketplace' | 'deals' | 'leads' | 'giftcards' | 'products';

// Each support area: its setting key, a label for the admin UI, and a short
// phrase for the "the dealer is currently in …" hint in the prompt.
export const ASSISTANT_AREAS: { area: AssistantArea; key: string; label: string; hint: string }[] = [
  { area: 'general', key: AI_SETTING_KEYS.assistantKnowledge, label: 'General', hint: 'the portal' },
  { area: 'marketplace', key: AI_SETTING_KEYS.knowledgeMarketplace, label: 'Marketplace', hint: 'the Marketplace (ordering gear & materials)' },
  { area: 'deals', key: AI_SETTING_KEYS.knowledgeDeals, label: 'Deals / Applications', hint: 'a credit application / deal' },
  { area: 'leads', key: AI_SETTING_KEYS.knowledgeLeads, label: 'Leads', hint: 'Home Depot leads' },
  { area: 'giftcards', key: AI_SETTING_KEYS.knowledgeGiftCards, label: 'Gift cards', hint: 'water-test gift cards' },
  { area: 'products', key: AI_SETTING_KEYS.knowledgeProducts, label: 'Products', hint: 'products (equipment, specs, the Product Library)' },
];

/** Combined knowledge (General + the area) and a hint, for the assistant prompt. */
export async function getAssistantKnowledgeFor(area: AssistantArea): Promise<{ knowledge: string; hint: string }> {
  const general = ASSISTANT_AREAS.find((a) => a.area === 'general')!;
  const target = ASSISTANT_AREAS.find((a) => a.area === area) ?? general;
  const [g, s] = await getSettings([general.key, target.key]).then((m) => [m[general.key], m[target.key]] as const);
  const parts: string[] = [];
  if (g?.trim()) parts.push(g.trim());
  if (target.area !== 'general' && s?.trim()) parts.push(`--- ${target.label} ---\n${s.trim()}`);
  return { knowledge: parts.join('\n\n'), hint: target.hint };
}

// Which 2026 journal the "Write to Journal" feature writes to: the safe TEST
// journal (default, env JOURNAL_SHEET_ID) or the real LIVE journal
// (env JOURNAL_SHEET_ID_2026). Reporting always reads the live journal — this
// toggle only controls the WRITE target, so deals can keep landing in the test
// sheet until the cutover.
export const JOURNAL_SETTING_KEYS = {
  writeMode: 'journal.writeMode',
} as const;

export type JournalWriteMode = 'test' | 'live';

export async function getJournalWriteMode(): Promise<JournalWriteMode> {
  // Read straight from the DB, NOT the shared in-process settings cache. This
  // controls where REAL deals get written, and in production Next.js serves
  // renders and server actions from separate worker processes that each keep
  // their own module-level cache — so a value cached at startup could lag the
  // admin's Test/Live toggle (the toggle would "save" but writes/reads keep the
  // old mode). One tiny indexed row read per journal write / settings page load
  // is negligible, and it guarantees the toggle takes effect everywhere at once.
  const row = await prisma.appSetting.findUnique({
    where: { key: JOURNAL_SETTING_KEYS.writeMode },
  });
  const v = row?.value?.trim();
  return v === 'live' ? 'live' : 'test';
}

// Global customer search — a privacy-sensitive feature that lets internal staff
// search all customers, and lets dealers look up which office a customer belongs
// to. OFF by default; an admin turns it on explicitly.
export const SEARCH_SETTING_KEYS = {
  globalEnabled: 'search.globalEnabled',
} as const;

export async function isGlobalSearchEnabled(): Promise<boolean> {
  return (await getSetting(SEARCH_SETTING_KEYS.globalEnabled)) === 'true';
}

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

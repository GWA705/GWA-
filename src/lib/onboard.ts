// Shared constants for the public new-dealer intake (/request-access).
// Kept out of any 'use server' module (those may only export async functions).

/** AppSetting key holding the shared access code for the public intake form. */
export const ONBOARD_CODE_KEY = 'onboard.accessCode';

/** Absolute base URL of the portal, for building the shareable intake link. */
export function portalBaseUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

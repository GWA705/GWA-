'use server';

import { requireSession } from '@/lib/session';
import { translateText, type TranslateTarget } from '@/lib/translate';

/**
 * Translate a piece of user-typed content to the requested language. Auth-gated
 * (only signed-in users) and length-capped to keep DeepL usage sane. Used by
 * the <TranslateText> control for on-demand FR↔EN of notes and free text.
 */
export async function translateContent(
  text: string,
  target: TranslateTarget,
): Promise<{ ok: boolean; text: string; detectedSource?: string; error?: string }> {
  await requireSession();
  const trimmed = (text ?? '').slice(0, 5000);
  const result = await translateText(trimmed, target);
  return { ok: result.ok, text: result.text, detectedSource: result.detectedSource, error: result.error };
}

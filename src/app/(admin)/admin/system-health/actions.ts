'use server';

import { requireAdminSection } from '@/lib/session';
import { translateText, providerLabel, type TranslateProvider } from '@/lib/translate';
import { getSetting, setSetting, AI_SETTING_KEYS } from '@/lib/settings';

const KNOWLEDGE_MAX = 20000;

/** Read the AI assistant's team knowledge (admin-editable). */
export async function getAssistantKnowledge(): Promise<string> {
  await requireAdminSection('system-health');
  return (await getSetting(AI_SETTING_KEYS.assistantKnowledge)) ?? '';
}

/** Save the AI assistant's team knowledge. Empty string clears it. */
export async function saveAssistantKnowledge(value: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSection('system-health');
  if (typeof value !== 'string') return { ok: false, error: 'Invalid value.' };
  if (value.length > KNOWLEDGE_MAX) return { ok: false, error: `Too long (max ${KNOWLEDGE_MAX} characters).` };
  await setSetting(AI_SETTING_KEYS.assistantKnowledge, value);
  return { ok: true };
}

export interface TranslateHealthResult {
  ok: boolean;
  provider: TranslateProvider;
  providerName: string;
  input: string;
  output: string;
  detectedSource?: string;
  error?: string;
}

/**
 * Live round-trip test of the translation provider chain: translates a known
 * French phrase to English and reports which provider answered. On-demand
 * (button) so it doesn't spend DeepL quota on every page load.
 */
export async function runTranslateHealthCheck(): Promise<TranslateHealthResult> {
  await requireAdminSection('system-health');
  const input = 'Bonjour, ceci est un test de traduction.';
  const r = await translateText(input, 'EN', 'FR');
  return {
    ok: r.ok,
    provider: r.provider ?? 'none',
    providerName: providerLabel(r.provider),
    input,
    output: r.text,
    detectedSource: r.detectedSource,
    error: r.error,
  };
}

'use server';

import { requireAdminSection } from '@/lib/session';
import { translateText, providerLabel, type TranslateProvider } from '@/lib/translate';

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

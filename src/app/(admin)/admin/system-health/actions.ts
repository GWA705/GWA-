'use server';

import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { translateText, providerLabel, type TranslateProvider } from '@/lib/translate';
import { getSetting, setSetting, ASSISTANT_AREAS, type AssistantArea } from '@/lib/settings';

const KNOWLEDGE_MAX = 20000;

export interface QaRow {
  id: string;
  area: string;
  areaLabel: string;
  question: string;
  answer: string;
  deferred: boolean;
  promoted: boolean;
  createdAt: string;
}

/** Recent logged Q&As for the review panel. `onlyGaps` = answers the assistant punted on. */
export async function listAssistantQa(onlyGaps = false): Promise<QaRow[]> {
  await requireAdminSection('system-health');
  const rows = await prisma.assistantQa.findMany({
    where: onlyGaps ? { deferred: true, promoted: false } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const labelOf = (a: string) => ASSISTANT_AREAS.find((x) => x.area === a)?.label ?? a;
  return rows.map((r) => ({
    id: r.id,
    area: r.area,
    areaLabel: labelOf(r.area),
    question: r.question,
    answer: r.answer,
    deferred: r.deferred,
    promoted: r.promoted,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Append a Q&A to its area's knowledge (the human-approved "learning" step). */
export async function promoteQaToKnowledge(qaId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSection('system-health');
  const qa = await prisma.assistantQa.findUnique({ where: { id: qaId } });
  if (!qa) return { ok: false, error: 'Not found.' };
  const target = ASSISTANT_AREAS.find((a) => a.area === qa.area) ?? ASSISTANT_AREAS[0];
  const existing = (await getSetting(target.key)) ?? '';
  const addition = `Q: ${qa.question.trim()}\nA: ${qa.answer.trim()}`;
  const next = existing.trim() ? `${existing.trim()}\n\n${addition}` : addition;
  if (next.length > KNOWLEDGE_MAX) {
    return { ok: false, error: `That would exceed the ${target.label} knowledge limit — trim it there first.` };
  }
  await setSetting(target.key, next);
  await prisma.assistantQa.update({ where: { id: qaId }, data: { promoted: true } });
  return { ok: true };
}

/** Remove a logged Q&A. */
export async function deleteAssistantQa(qaId: string): Promise<{ ok: boolean }> {
  await requireAdminSection('system-health');
  await prisma.assistantQa.delete({ where: { id: qaId } }).catch(() => {});
  return { ok: true };
}

/** Save the AI assistant's team knowledge for one area. Empty string clears it. */
export async function saveAssistantKnowledge(area: AssistantArea, value: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSection('system-health');
  const target = ASSISTANT_AREAS.find((a) => a.area === area);
  if (!target) return { ok: false, error: 'Unknown area.' };
  if (typeof value !== 'string') return { ok: false, error: 'Invalid value.' };
  if (value.length > KNOWLEDGE_MAX) return { ok: false, error: `Too long (max ${KNOWLEDGE_MAX} characters).` };
  await setSetting(target.key, value);
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

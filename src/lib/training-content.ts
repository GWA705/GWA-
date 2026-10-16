import { getSetting, setSetting } from './settings';
import {
  QUIZ, RULES, coerceQuiz, coerceRules, localizeQuiz, localizeRules, sectionsFor,
  type QuizQuestion, type Rule, type Section, type Lang, type TrainingOverride,
} from './training';

// Where the admin-edited quiz + rules override lives. Unset = use the built-in
// defaults from training.ts. The English structure (ids + correct answers) is
// authoritative; French is a display layer over it.
export const TRAINING_CONTENT_KEY = 'training.quizRules';

/** The admin override, or null when none is set (defaults apply). Always returns
 *  a well-formed value — a corrupt stored blob is treated as "no override". */
export async function getTrainingOverride(): Promise<TrainingOverride | null> {
  const raw = await getSetting(TRAINING_CONTENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { quiz?: unknown; rules?: unknown };
    const quiz = coerceQuiz(parsed.quiz);
    const rules = coerceRules(parsed.rules);
    if (quiz.length === 0 || rules.length === 0) return null;
    return { quiz, rules };
  } catch {
    return null;
  }
}

/** The effective (authoritative, English) quiz + rules used for scoring, storage
 *  and as the base for localization. */
export async function getEffectiveContent(): Promise<{ quiz: QuizQuestion[]; rules: Rule[] }> {
  const override = await getTrainingOverride();
  return override ?? { quiz: QUIZ, rules: RULES };
}

/** Save (or clear) the admin override. Coerces to a clean shape; both lists must
 *  be non-empty or the save is rejected so trainees never hit an empty program. */
export async function saveTrainingOverride(
  quizInput: unknown,
  rulesInput: unknown,
): Promise<{ ok: boolean; error?: string; quiz: QuizQuestion[]; rules: Rule[] }> {
  const quiz = coerceQuiz(quizInput);
  const rules = coerceRules(rulesInput);
  if (quiz.length === 0) return { ok: false, error: 'Add at least one valid quiz question.', quiz, rules };
  if (rules.length === 0) return { ok: false, error: 'Add at least one rule.', quiz, rules };
  await setSetting(TRAINING_CONTENT_KEY, JSON.stringify({ quiz, rules }));
  return { ok: true, quiz, rules };
}

/** Reset to the built-in defaults. */
export async function resetTrainingOverride(): Promise<void> {
  await setSetting(TRAINING_CONTENT_KEY, '');
}

// How many questions to ask each attempt. Unset / 0 = ask the whole pool. When
// set below the pool size, each trainee gets a different random subset (plus the
// usual shuffled order + options) so a fixed set can't be coached.
export const TRAINING_ASK_COUNT_KEY = 'training.askCount';

/** The configured ask-count, or null for "ask all". */
export async function getTrainingAskCount(): Promise<number | null> {
  const raw = await getSetting(TRAINING_ASK_COUNT_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Save the ask-count (0 or blank clears it → ask the whole pool). */
export async function setTrainingAskCount(n: number): Promise<void> {
  await setSetting(TRAINING_ASK_COUNT_KEY, Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : '');
}

// ---------------------------------------------------------------------------
// Rollout gating: which offices can see + use the Lead Gen Training module.
// Stored as a JSON array of dealer ids in app settings. Semantics:
//   unset / empty  -> ALL offices (the default, and "turn it on for everyone"),
//   non-empty list -> ONLY those offices (start with just Georgian Water & Air,
//                     add more as they're ready — same idea as lead-texting).
// ---------------------------------------------------------------------------
export const TRAINING_OFFICES_KEY = 'training.enabledOffices';

/** The office allowlist, or null when training is open to every office. */
export async function getTrainingEnabledOffices(): Promise<string[] | null> {
  const raw = await getSetting(TRAINING_OFFICES_KEY);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const ids = arr.filter((x): x is string => typeof x === 'string' && x.length > 0);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

/** Whether a given office may see + use the training module. */
export async function isTrainingEnabledForDealer(dealerId: string | null | undefined): Promise<boolean> {
  if (!dealerId) return false;
  const list = await getTrainingEnabledOffices();
  return list === null ? true : list.includes(dealerId);
}

/** Save the office allowlist. An empty list clears it (back to all offices). */
export async function setTrainingEnabledOffices(ids: string[]): Promise<void> {
  const clean = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.length > 0)));
  await setSetting(TRAINING_OFFICES_KEY, clean.length ? JSON.stringify(clean) : '');
}

export interface LocalizedBundle {
  lang: Lang;
  sections: Section[];
  quiz: QuizQuestion[];
  rules: Rule[];
}

/** Build the content bundle a single language of the public flow renders. The
 *  quiz/rules keep their ids + correct indices across languages, so scoring is
 *  identical regardless of the language the trainee chose. */
export function localizedBundle(base: { quiz: QuizQuestion[]; rules: Rule[] }, lang: Lang): LocalizedBundle {
  return {
    lang,
    sections: sectionsFor(lang),
    quiz: localizeQuiz(base.quiz, lang),
    rules: localizeRules(base.rules, lang),
  };
}

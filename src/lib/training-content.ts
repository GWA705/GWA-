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

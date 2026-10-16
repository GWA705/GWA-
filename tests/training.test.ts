import { describe, it, expect } from 'vitest';
import {
  QUIZ, RULES, scoreQuiz, validateSubmission, PASS_THRESHOLD, sampleQuiz,
  localizeQuiz, localizeRules, coerceQuiz, coerceRules, QUIZ_FR, RULES_FR,
  type QuizQuestion, type Rule,
} from '@/lib/training';

const allCorrect = Object.fromEntries(QUIZ.map((q) => [q.id, q.correct]));
const allRules = RULES.map((r) => r.id);

describe('training scoring', () => {
  it('scores a perfect quiz as 100% and passing', () => {
    const r = scoreQuiz(allCorrect);
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
    expect(r.correct).toBe(QUIZ.length);
  });

  it('fails when below the pass threshold', () => {
    // Answer everything wrong (shift each answer by 1).
    const wrong = Object.fromEntries(QUIZ.map((q) => [q.id, (q.correct + 1) % q.options.length]));
    const r = scoreQuiz(wrong);
    expect(r.score).toBeLessThan(PASS_THRESHOLD);
    expect(r.passed).toBe(false);
  });
});

describe('question pool sampling', () => {
  it('returns the whole pool when n >= pool size', () => {
    expect(sampleQuiz(QUIZ, QUIZ.length)).toBe(QUIZ);
    expect(sampleQuiz(QUIZ, QUIZ.length + 5).length).toBe(QUIZ.length);
  });
  it('returns exactly n distinct questions drawn from the pool', () => {
    const n = 5;
    const picked = sampleQuiz(QUIZ, n);
    expect(picked.length).toBe(n);
    const ids = new Set(picked.map((q) => q.id));
    expect(ids.size).toBe(n); // no duplicates
    const poolIds = new Set(QUIZ.map((q) => q.id));
    expect(picked.every((q) => poolIds.has(q.id))).toBe(true);
  });
  it('a subset is fully gradeable against itself', () => {
    const subset = sampleQuiz(QUIZ, 6);
    const allCorrectSubset = Object.fromEntries(subset.map((q) => [q.id, q.correct]));
    expect(scoreQuiz(allCorrectSubset, subset).passed).toBe(true);
  });
});

describe('training submission validation', () => {
  const base = {
    traineeName: 'Jamie Lee',
    traineeEmail: 'jamie@example.com',
    traineePhone: '705-555-0123',
    answers: allCorrect,
    acknowledged: allRules,
    signatureName: 'Jamie Lee',
  };

  it('accepts a complete, passing, fully-acknowledged submission', () => {
    expect(validateSubmission(base).ok).toBe(true);
  });

  it('requires name, valid email, and phone', () => {
    expect(validateSubmission({ ...base, traineeName: '' }).ok).toBe(false);
    expect(validateSubmission({ ...base, traineeEmail: 'nope' }).ok).toBe(false);
    expect(validateSubmission({ ...base, traineePhone: '123' }).ok).toBe(false);
  });

  it('requires every question answered', () => {
    const missing = { ...allCorrect };
    delete missing[QUIZ[0].id];
    expect(validateSubmission({ ...base, answers: missing }).ok).toBe(false);
  });

  it('requires a passing score', () => {
    const wrong = Object.fromEntries(QUIZ.map((q) => [q.id, (q.correct + 1) % q.options.length]));
    expect(validateSubmission({ ...base, answers: wrong }).ok).toBe(false);
  });

  it('requires every rule acknowledged', () => {
    expect(validateSubmission({ ...base, acknowledged: allRules.slice(1) }).ok).toBe(false);
  });

  it('requires a typed signature', () => {
    expect(validateSubmission({ ...base, signatureName: '' }).ok).toBe(false);
  });
});

describe('custom (admin-edited) quiz + rules', () => {
  const quiz: QuizQuestion[] = [
    { id: 'c1', q: 'Pick A', options: ['A', 'B'], correct: 0 },
    { id: 'c2', q: 'Pick B', options: ['A', 'B'], correct: 1 },
  ];
  const rules: Rule[] = [{ id: 'cr1', text: 'I agree' }];

  it('scores against the supplied quiz, not the defaults', () => {
    expect(scoreQuiz({ c1: 0, c2: 1 }, quiz).score).toBe(100);
    expect(scoreQuiz({ c1: 1, c2: 1 }, quiz).score).toBe(50);
  });

  it('validates against supplied quiz + rules', () => {
    const sub = { traineeName: 'Ann Lee', traineeEmail: 'a@b.com', traineePhone: '7055550123', answers: { c1: 0, c2: 1 }, acknowledged: ['cr1'], signatureName: 'Ann Lee' };
    expect(validateSubmission(sub, quiz, rules).ok).toBe(true);
    // Default rules would reject this (no default rule ids acknowledged).
    expect(validateSubmission(sub, quiz).ok).toBe(false);
  });
});

describe('localization', () => {
  it('translates quiz display but keeps ids + correct index', () => {
    const fr = localizeQuiz(QUIZ, 'fr');
    for (let i = 0; i < QUIZ.length; i++) {
      expect(fr[i].id).toBe(QUIZ[i].id);
      expect(fr[i].correct).toBe(QUIZ[i].correct);
      expect(fr[i].options.length).toBe(QUIZ[i].options.length);
      if (QUIZ_FR[QUIZ[i].id]) expect(fr[i].q).toBe(QUIZ_FR[QUIZ[i].id].q);
    }
    // Scoring is identical regardless of language.
    const all = Object.fromEntries(QUIZ.map((q) => [q.id, q.correct]));
    expect(scoreQuiz(all, fr).score).toBe(100);
  });

  it('falls back to English for untranslated questions', () => {
    const custom: QuizQuestion[] = [{ id: 'new-q', q: 'English only', options: ['x', 'y'], correct: 0 }];
    expect(localizeQuiz(custom, 'fr')[0].q).toBe('English only');
  });

  it('translates rules by id with fallback', () => {
    const fr = localizeRules(RULES, 'fr');
    expect(fr[0].id).toBe(RULES[0].id);
    if (RULES_FR[RULES[0].id]) expect(fr[0].text).toBe(RULES_FR[RULES[0].id]);
    expect(localizeRules([{ id: 'z', text: 'keep me' }], 'fr')[0].text).toBe('keep me');
  });

  it('returns English unchanged', () => {
    expect(localizeQuiz(QUIZ, 'en')).toBe(QUIZ);
    expect(localizeRules(RULES, 'en')).toBe(RULES);
  });
});

describe('coercion (admin editor input)', () => {
  it('drops invalid questions and clamps correct index', () => {
    const out = coerceQuiz([
      { q: 'Good', options: ['a', 'b'], correct: 5 }, // correct out of range -> 0
      { q: '', options: ['a', 'b'], correct: 0 },     // empty prompt -> dropped
      { q: 'OneOpt', options: ['only'], correct: 0 }, // <2 options -> dropped
      { q: 'Blanks', options: ['a', '', 'b'], correct: 0 }, // blank option filtered
    ]);
    expect(out.length).toBe(2);
    expect(out[0].correct).toBe(0);
    expect(out[0].id).toBeTruthy();
    expect(out[1].options).toEqual(['a', 'b']);
  });

  it('gives questions unique ids', () => {
    const out = coerceQuiz([
      { q: 'Same', options: ['a', 'b'], correct: 0 },
      { q: 'Same', options: ['a', 'b'], correct: 0 },
    ]);
    expect(out[0].id).not.toBe(out[1].id);
  });

  it('coerces rules from strings or objects and drops blanks', () => {
    const out = coerceRules(['Wear boots', { text: 'Sign in' }, '', { text: '  ' }]);
    expect(out.map((r) => r.text)).toEqual(['Wear boots', 'Sign in']);
    expect(out.every((r) => r.id)).toBe(true);
  });
});

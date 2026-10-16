import { describe, it, expect } from 'vitest';
import { QUIZ, RULES, scoreQuiz, validateSubmission, PASS_THRESHOLD } from '@/lib/training';

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

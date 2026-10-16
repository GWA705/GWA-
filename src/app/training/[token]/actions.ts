'use server';

import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sendTrainingCertificationEmails } from '@/lib/training-email';
import { advancePendingIdTagsForCert, markIdTagEmailed } from '@/lib/idTag';
import { sendIdTagNewRepEmail } from '@/lib/idTag-email';
import { getEffectiveContent } from '@/lib/training-content';
import {
  CONTENT_VERSION,
  scoreQuiz,
  validateSubmission,
  type TrainingSubmission,
  type SubmitResult,
} from '@/lib/training';

/**
 * Public (no-login) submission of a completed Lead-Generator training. Validates
 * the dealer token, rate-limits by IP, checks the submission is complete + passing
 * + fully acknowledged + signed, then stores the full record (answers, score, the
 * rules acknowledged, the typed signature, content version, IP + time) for Home
 * Depot compliance. The quiz is re-scored on the server — the client can't fake a
 * pass.
 */
export async function submitTrainingAction(
  token: string,
  payload: TrainingSubmission,
): Promise<SubmitResult> {
  const ip = clientIp();
  const rl = await rateLimit(`training:${ip}`, 20, 60 * 60); // 20 submissions/hour/IP
  if (!rl.ok) return { ok: false, error: 'Too many attempts. Please wait a little while and try again.' };

  const dealer = await prisma.dealer.findUnique({ where: { trainingToken: token }, select: { id: true, active: true } });
  if (!dealer || !dealer.active) return { ok: false, error: 'This training link is no longer valid. Please ask your office for a new one.' };

  // Score + validate against the EFFECTIVE (possibly admin-edited) program — the
  // trainee must be judged against the exact questions they were shown.
  const { quiz, rules } = await getEffectiveContent();
  const check = validateSubmission(payload, quiz, rules);
  if (!check.ok) return { ok: false, error: check.error };

  const answers = payload.answers || {};
  const { passed } = scoreQuiz(answers, quiz);
  // Under the mastery model the final answers are all correct, so the meaningful
  // score is the FIRST attempt (what they knew before the teach-then-retry loop).
  const firstAnswers = payload.firstAnswers && Object.keys(payload.firstAnswers).length ? payload.firstAnswers : answers;
  const { score } = scoreQuiz(firstAnswers, quiz);
  const lang = payload.lang === 'fr' ? 'fr' : 'en';
  const ua = headers().get('user-agent')?.slice(0, 300) || null;

  try {
    const cert = await prisma.trainingCertification.create({
      data: {
        dealerId: dealer.id,
        traineeName: (payload.traineeName || '').trim(),
        traineeEmail: (payload.traineeEmail || '').trim(),
        traineePhone: (payload.traineePhone || '').trim(),
        traineeAddress: (payload.traineeAddress || '').trim() || null,
        traineeCity: (payload.traineeCity || '').trim() || null,
        traineePostal: (payload.traineePostal || '').trim() || null,
        startDate: (payload.startDate || '').trim() || null,
        answers,
        score,
        passed,
        acknowledged: payload.acknowledged || [],
        signatureName: (payload.signatureName || '').trim(),
        contentVersion: CONTENT_VERSION,
        // Snapshot the exact program the trainee saw so the certificate always
        // renders faithfully, even if an admin edits the quiz/rules later.
        // Also snapshot the first-attempt answers so the "what to review" record
        // and the emailed answer-review PDF reflect what they originally missed.
        contentSnapshot: { quiz, rules, firstAnswers } as unknown as Prisma.InputJsonValue,
        language: lang,
        ipAddress: ip === 'unknown' ? null : ip,
        userAgent: ua,
      },
      select: { id: true },
    });
    // Best-effort confirmation to the trainee + office. Never blocks or fails the
    // submission; comes alive once the dedicated SES sender is switched on.
    void sendTrainingCertificationEmails({
      certId: cert.id,
      dealerId: dealer.id,
      traineeName: (payload.traineeName || '').trim(),
      traineeEmail: (payload.traineeEmail || '').trim(),
      score,
      passed,
      // Extra context for the emailed PDFs (certificate + answer review).
      startDate: (payload.startDate || '').trim() || null,
      signatureName: (payload.signatureName || '').trim(),
      lang,
      quiz,
      firstAnswers,
    });

    // If this person had an ID-tag request parked for "needs training", it now
    // clears: advance it to Submitted and fire their background-check email.
    void (async () => {
      try {
        const advanced = await advancePendingIdTagsForCert({
          dealerId: dealer.id,
          traineeName: (payload.traineeName || '').trim(),
          traineeEmail: (payload.traineeEmail || '').trim(),
          certId: cert.id,
        });
        for (const a of advanced) {
          if (a.personEmail) {
            const sent = await sendIdTagNewRepEmail(a.personEmail, a.personName);
            if (sent) await markIdTagEmailed(a.id);
          }
        }
      } catch (e) {
        console.error('[training] id-tag advance failed', e);
      }
    })();

    return { ok: true, certificationId: cert.id, score };
  } catch (e) {
    console.error('[training] submit failed', e);
    return { ok: false, error: 'Something went wrong saving your training. Please try again.' };
  }
}

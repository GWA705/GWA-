'use server';

import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sendTrainingCertificationEmails } from '@/lib/training-email';
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
  const { score, passed } = scoreQuiz(answers, quiz);
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
        answers,
        score,
        passed,
        acknowledged: payload.acknowledged || [],
        signatureName: (payload.signatureName || '').trim(),
        contentVersion: CONTENT_VERSION,
        // Snapshot the exact program the trainee saw so the certificate always
        // renders faithfully, even if an admin edits the quiz/rules later.
        contentSnapshot: { quiz, rules } as unknown as Prisma.InputJsonValue,
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
    });
    return { ok: true, certificationId: cert.id, score };
  } catch (e) {
    console.error('[training] submit failed', e);
    return { ok: false, error: 'Something went wrong saving your training. Please try again.' };
  }
}

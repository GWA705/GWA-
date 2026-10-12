import Link from 'next/link';
import type { ConfirmationIssue } from '@/lib/confirmationIssue';
import { getT } from '@/i18n/server';

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Prominent top-of-deal banner shown when a confirmer has flagged an issue to the
 * dealer (confirmation call). Mirrors the "what's needed from the dealer" callout:
 * red while awaiting the office's acknowledgement, green once they've confirmed
 * they read it. Links to the portal Mail where the office acknowledges (and where
 * staff can see who has). `side` tailors the wording + link to who's looking.
 */
export function ConfirmationIssueBanner({
  side,
  issue,
}: {
  side: 'staff' | 'dealer';
  issue: ConfirmationIssue;
}) {
  const t = getT();
  const { acknowledged, body, ackByName, ackAt, flaggedAt, mailId } = issue;
  const mailHref = side === 'staff' ? `/staff/mail/${mailId}` : `/dealer/mail/${mailId}`;

  const tone = acknowledged
    ? 'border-green-300 bg-green-50'
    : 'border-red-300 bg-red-50';
  const iconTone = acknowledged ? 'bg-green-500' : 'bg-red-500';
  const headTone = acknowledged ? 'text-green-800' : 'text-red-800';

  const heading = acknowledged
    ? t('dealParts.confirmIssue.acknowledgedHeading')
    : side === 'staff'
      ? t('dealParts.confirmIssue.flaggedStaff')
      : t('dealParts.confirmIssue.flaggedDealer');

  return (
    <section className={`flex items-start gap-3 rounded-lg border-2 p-4 ${tone}`}>
      <span
        aria-hidden
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${iconTone}`}
      >
        {acknowledged ? '✓' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className={`text-sm font-semibold ${headTone}`}>{heading}</h2>

        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{body}</p>

        {acknowledged ? (
          <p className="mt-2 text-xs text-green-700">
            {t('dealParts.confirmIssue.acknowledged')}{ackByName ? t('dealParts.confirmIssue.byName', { name: ackByName }) : ''}{ackAt ? t('dealParts.confirmIssue.onDate', { date: fmtDate(ackAt) }) : ''}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-red-700">
            {side === 'staff'
              ? t('dealParts.confirmIssue.flaggedAwaiting', { date: fmtDate(flaggedAt) })
              : t('dealParts.confirmIssue.pleaseOpen')}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm">
          {side === 'dealer' && !acknowledged ? (
            <Link
              href={mailHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              {t('dealParts.confirmIssue.openAcknowledge')}
            </Link>
          ) : (
            <Link href={mailHref} className="font-semibold text-brand-700 hover:underline">
              {side === 'staff' ? t('dealParts.confirmIssue.viewInMailStaff') : t('dealParts.confirmIssue.viewInMail')}
            </Link>
          )}
          {side === 'staff' && (
            <span className="text-xs text-gray-500">{t('dealParts.confirmIssue.dealerCanReply')}</span>
          )}
        </div>
      </div>
    </section>
  );
}

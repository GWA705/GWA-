import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { ConversationThread } from '@/components/ConversationThread';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function StaffConversationThreadPage({ params }: { params: { id: string } }) {
  await requireRole('REVIEWER', 'ADMIN');
  const t = getT();
  const conv = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      dealer: { select: { name: true } },
      application: { select: { id: true, applicantFirstName: true, applicantLastName: true } },
    },
  });
  if (!conv) notFound();

  const title =
    conv.kind === 'SUPPORT'
      ? t('staffConversations.thread.titleSupport', { dealer: conv.dealer.name })
      : `${conv.application?.applicantFirstName ?? ''} ${conv.application?.applicantLastName ?? ''}`.trim() || t('staffConversations.thread.dealFallback');
  const scope = conv.kind === 'DEAL' ? conv.dealer.name : t('staffConversations.thread.generalSupport');

  return (
    <div className="space-y-4">
      <div>
        <Link href="/staff/conversations" className="text-sm text-gray-500 hover:underline">{t('staffConversations.thread.back')}</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {conv.application && (
            <Link href={`/staff/applications/${conv.application.id}`} className="btn-secondary text-xs">{t('staffConversations.thread.openDeal')}</Link>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{t('staffConversations.thread.seesYouAsReviewer', { scope })}</p>
      </div>

      <ConversationThread conversationId={conv.id} heightClass="h-[60vh]" placeholder={t('staffConversations.thread.messagePlaceholder')} />
    </div>
  );
}

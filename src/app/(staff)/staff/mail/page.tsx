import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getT } from '@/i18n/server';
import { MailComposeForm } from './MailComposeForm';

export const dynamic = 'force-dynamic';

export default async function StaffMail() {
  await requireStaffSection('mail');
  const t = getT();

  const [dealers, mails, unreadReplies] = await Promise.all([
    prisma.dealer.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        users: {
          where: { active: true, role: 'DEALER_USER' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, isDistributor: true },
        },
      },
    }),
    prisma.mail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        sender: { select: { name: true } },
        _count: { select: { attachments: true, recipients: true, receipts: true } },
      },
    }),
    // Unread dealer replies per mail (fromStaff=false, not yet seen by staff).
    prisma.mailReply.groupBy({
      by: ['mailId'],
      where: { fromStaff: false, staffReadAt: null },
      _count: { _all: true },
    }),
  ]);
  const unreadByMail = new Map(unreadReplies.map((u) => [u.mailId, u._count._all]));

  return (
    <div className="space-y-6">
      <SectionHero
        eyebrow={t('staffMail.eyebrow')}
        title={t('staffMail.title')}
        subtitle={t('staffMail.subtitle')}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="card p-6">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">{t('staffMail.composeHeading')}</h2>
        <p className="mb-5 text-sm text-gray-500">{t('staffMail.composeHint')}</p>
        <MailComposeForm dealers={dealers} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t('staffMail.sentHeading')}</h2>
        {mails.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">{t('staffMail.emptySent')}</div>
        ) : (
          <div className="card divide-y divide-gray-100">
            {mails.map((m) => {
              const unread = unreadByMail.get(m.id) ?? 0;
              return (
              <Link key={m.id} href={`/staff/mail/${m.id}`} className="block p-4 hover:bg-gray-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{m.subject}</span>
                  {m.requireAck && <span className="badge bg-amber-100 text-amber-800">{t('staffMail.badgeAckRequired')}</span>}
                  {unread > 0 && (
                    <span className="badge bg-green-100 text-green-800">{t(unread === 1 ? 'staffMail.newReplyOne' : 'staffMail.newReplyMany', { n: unread })}</span>
                  )}
                  {m._count.attachments > 0 && <span className="badge bg-gray-100 text-gray-600">{t('staffMail.attachments', { n: m._count.attachments })}</span>}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {m.sender.name} · {m.createdAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} ·{' '}
                  {m.allDealers ? t('staffMail.allDealers') : t('staffMail.dealerCount', { n: m._count.recipients })} · {t('staffMail.opened', { n: m._count.receipts })}
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

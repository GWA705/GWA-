import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { queryGiftCards, monthLabel } from '@/lib/giftCardHistory';
import { GiftCardForm } from './GiftCardForm';
import { GiftCardBulkImport } from './GiftCardBulkImport';
import { PageHeader } from '@/components/PageHeader';
import { DealerGiftCards, type DealerRequestVM } from './DealerGiftCards';
import { GiftCardBrowseControls } from '@/components/GiftCardBrowseControls';
import { GiftCardPager } from '@/components/GiftCardPager';

export const dynamic = 'force-dynamic';

function stamp(d: Date): string {
  return d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
const noteAt = (d: Date) => d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type RowNote = { id: string; body: string; fromDealer: boolean; createdAt: Date; author: { name: string | null } | null };

export default async function DealerGiftCardsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; month?: string; sort?: string; perPage?: string; page?: string };
}) {
  const session = await requireDealerAccess();
  const dealerId = session.dealerId ?? null;

  const result = dealerId
    ? await queryGiftCards({ dealerId, includeNotes: true, ...searchParams })
    : { rows: [], total: 0, page: 1, pageCount: 1, perPage: 25 as number | 'all', isAll: false, months: [] as string[], q: '', status: '', sort: 'newest', month: '', firstShown: 0, lastShown: 0 };

  const requests: DealerRequestVM[] = result.rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    amount: Number(r.amount),
    status: r.status as DealerRequestVM['status'],
    sentAt: r.sentAt ? stamp(r.sentAt) : null,
    dealerUnread: r.dealerUnread,
    // notes are included for the dealer view (includeNotes: true)
    notes: ((r as unknown as { notes?: RowNote[] }).notes ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      fromDealer: n.fromDealer,
      author: n.author?.name ?? '—',
      at: noteAt(n.createdAt),
    })),
  }));

  const [pendingCount] = dealerId
    ? await Promise.all([prisma.giftCardRequest.count({ where: { dealerId, status: 'PENDING' } })])
    : [0];

  // Now that they're viewing the area, clear their unread flags.
  if (dealerId) {
    await prisma.giftCardRequest.updateMany({ where: { dealerId, dealerUnread: true }, data: { dealerUnread: false } });
  }

  const monthOpts = result.months.map((m) => ({ value: m, label: monthLabel(m) }));
  const filtered = !!(result.q || result.status || result.month);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Rewards"
        title="Water-test gift cards"
        subtitle="Completed a water test? Request the customer's Home Depot gift card here. We email it through Guusto and mark it sent — you'll get a dated receipt below. Wrong email, or need to send by text? Open a request to fix the details or message the team."
      />

      <div className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-gray-900">New request</h2>
        <GiftCardForm defaultAmount={25} />
        <GiftCardBulkImport />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">Your requests</h2>
          {pendingCount > 0 && <span className="badge bg-amber-100 text-amber-800">{pendingCount} awaiting send</span>}
        </div>
        <div className="border-b border-gray-100 px-4 py-3">
          <GiftCardBrowseControls
            basePath="/dealer/gift-cards"
            q={result.q}
            status={result.status}
            month={result.month}
            sort={result.sort}
            perPage={String(result.perPage)}
            months={monthOpts}
          />
        </div>
        {result.total === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            {filtered ? 'No requests match your search or filters.' : 'No gift-card requests yet.'}
          </div>
        ) : (
          <>
            <DealerGiftCards requests={requests} />
            <div className="px-4 pb-3">
              <GiftCardPager
                basePath="/dealer/gift-cards"
                perPage={result.perPage}
                page={result.page}
                pageCount={result.pageCount}
                firstShown={result.firstShown}
                lastShown={result.lastShown}
                total={result.total}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { loadGiftCardQueue } from '@/lib/giftCardQueueData';
import { queryGiftCards, monthLabel } from '@/lib/giftCardHistory';
import { GiftCardQueue } from './GiftCardQueue';
import { StaffFlaggedGiftCards } from './StaffFlaggedGiftCards';
import { GiftCardHistory, type HistoryRow } from './GiftCardHistory';

export const dynamic = 'force-dynamic';

const stamp = (d: Date) =>
  d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function AdminGiftCardsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; month?: string; sort?: string; perPage?: string; page?: string };
}) {
  const admin = await requireAdminSection('gift-cards');
  const [{ pending, flagged }, history] = await Promise.all([
    loadGiftCardQueue(),
    queryGiftCards({ ...searchParams }),
  ]);

  const rows: HistoryRow[] = history.rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    dealerName: (r as { dealer?: { name: string | null } | null }).dealer?.name ?? '—',
    amount: Number(r.amount),
    status: r.status,
    at: stamp(r.createdAt),
  }));
  const months = history.months.map((m) => ({ value: m, label: monthLabel(m) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Water-test gift cards</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dealers submit a customer + card amount for each completed water test. Copy the selected emails (or CSV) into
            Guusto, send, then <strong>mark them sent</strong> — that stamps a dated receipt back to the dealer.
          </p>
        </div>
        {admin.superAdmin && (
          <Link href="/admin/guusto-test" className="shrink-0 text-sm text-brand-700 hover:underline">
            Guusto API test →
          </Link>
        )}
      </div>

      <StaffFlaggedGiftCards flagged={flagged} />

      <GiftCardQueue pending={pending} />

      <GiftCardHistory
        basePath="/admin/gift-cards"
        rows={rows}
        months={months}
        q={history.q}
        status={history.status}
        month={history.month}
        sort={history.sort}
        perPage={history.perPage}
        page={history.page}
        pageCount={history.pageCount}
        firstShown={history.firstShown}
        lastShown={history.lastShown}
        total={history.total}
      />
    </div>
  );
}

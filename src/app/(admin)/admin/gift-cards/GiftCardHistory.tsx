import { GiftCardBrowseControls } from '@/components/GiftCardBrowseControls';
import { GiftCardPager } from '@/components/GiftCardPager';

export interface HistoryRow {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  dealerName: string;
  amount: number;
  status: string;
  at: string;
}

function StatusPill({ status }: { status: string }) {
  if (status === 'SENT') return <span className="badge bg-green-100 text-green-800">Sent</span>;
  if (status === 'CANCELLED') return <span className="badge bg-gray-100 text-gray-500">Cancelled</span>;
  return <span className="badge bg-amber-100 text-amber-800">Pending</span>;
}

/**
 * Searchable, filterable, paginated history of gift-card requests across all
 * offices — the staff/admin view built to stay usable at hundreds a month.
 */
export function GiftCardHistory({
  basePath,
  rows,
  months,
  q,
  status,
  month,
  sort,
  perPage,
  page,
  pageCount,
  firstShown,
  lastShown,
  total,
}: {
  basePath: string;
  rows: HistoryRow[];
  months: { value: string; label: string }[];
  q: string;
  status: string;
  month: string;
  sort: string;
  perPage: number | 'all';
  page: number;
  pageCount: number;
  firstShown: number;
  lastShown: number;
  total: number;
}) {
  const filtered = !!(q || status || month);
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-base font-semibold text-gray-900">History</h2>
        <p className="mt-0.5 text-xs text-gray-500">Every request across all offices — search by customer, email, cell or office.</p>
      </div>
      <div className="border-b border-gray-100 px-4 py-3">
        <GiftCardBrowseControls
          basePath={basePath}
          q={q}
          status={status}
          month={month}
          sort={sort}
          perPage={String(perPage)}
          months={months}
          showStatus
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Email / cell</th>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {filtered ? 'No requests match your search or filters.' : 'No gift-card requests yet.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{r.customerEmail}</div>
                    {r.customerPhone && <div className="text-xs text-gray-500">📱 {r.customerPhone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.dealerName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">${r.amount}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{r.at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-3">
        <GiftCardPager
          basePath={basePath}
          perPage={perPage}
          page={page}
          pageCount={pageCount}
          firstShown={firstShown}
          lastShown={lastShown}
          total={total}
        />
      </div>
    </div>
  );
}

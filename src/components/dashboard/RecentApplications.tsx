import Link from 'next/link';
import { FileText, ArrowRight, Eye, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { ApplicationStatus } from '@prisma/client';

export interface RecentApp {
  id: string;
  name: string;
  province: string;
  program: string;
  amount: string;
  status: ApplicationStatus;
  submitted: string;
  actionNeeded: boolean;
}

/** The "Recent Applications" preview table on the dashboard. */
export function RecentApplications({ items }: { items: RecentApp[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <FileText size={20} className="text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-[#0d2a63]">Recent Applications</h3>
        </div>
        <Link href="/dealer/applications" className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
          View all applications <ArrowRight size={17} />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-slate-500">No applications yet — start with “New Customer.”</p>
      ) : (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-[#f5f8fc] text-[11px] uppercase text-slate-500">
                <th className="px-4 py-3 text-left">Applicant</th>
                <th className="px-4 py-3 text-left">Province</th>
                <th className="px-4 py-3 text-left">Program</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/dealer/applications/${a.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {a.name}
                    </Link>
                    {a.actionNeeded && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <AlertTriangle size={11} /> Action needed
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{a.province}</td>
                  <td className="px-4 py-3 text-sm">{a.program}</td>
                  <td className="px-4 py-3 text-sm font-medium">{a.amount}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-sm text-slate-500">{a.submitted}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dealer/applications/${a.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={14} /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

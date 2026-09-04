'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, Eye, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PinButton } from '@/components/PinButton';
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
  /** Reviewer flagged an issue / sent it back. */
  problem: boolean;
  /** Pinned to the top by this user. */
  pinned: boolean;
}

const COLLAPSED = 4;

/** The "Recent Applications" preview on the dashboard — pin, flag, expandable. */
export function RecentApplications({ items }: { items: RecentApp[] }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = items.length > COLLAPSED;
  const shown = expanded ? items : items.slice(0, COLLAPSED);

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
        <p className="px-5 pb-6 text-sm text-slate-500">No applications yet — start with &ldquo;New Customer.&rdquo;</p>
      ) : (
        <>
          {/* Mobile: a stacked card per application (the table scrolls sideways). */}
          <ul className="space-y-2.5 px-4 pb-1 sm:hidden">
            {shown.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border p-3 ${a.pinned ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dealer/applications/${a.id}`} className="text-sm font-semibold text-blue-600">
                    {a.name}
                  </Link>
                  <PinButton applicationId={a.id} pinned={a.pinned} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={a.status} />
                  {a.problem && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black leading-none text-white">!</span>
                      Sent back
                    </span>
                  )}
                  {a.actionNeeded && !a.problem && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <AlertTriangle size={11} /> Action needed
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{a.program} · {a.province}</span>
                  <span className="font-semibold text-slate-800">{a.amount}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Submitted {a.submitted}</span>
                  <Link href={`/dealer/applications/${a.id}`} className="inline-flex items-center gap-1 font-semibold text-blue-600">
                    <Eye size={13} /> View
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: the full table. */}
          <div className="hidden overflow-x-auto px-4 sm:block">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-[#f5f8fc] text-[11px] uppercase text-slate-500">
                  <th className="w-8 px-2 py-3" aria-label="Pin" />
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
                {shown.map((a) => (
                  <tr key={a.id} className={`border-t border-slate-100 hover:bg-slate-50 ${a.pinned ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-2 py-3 align-top">
                      <PinButton applicationId={a.id} pinned={a.pinned} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dealer/applications/${a.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {a.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.problem && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black leading-none text-white">!</span>
                            Sent back
                          </span>
                        )}
                        {a.actionNeeded && !a.problem && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            <AlertTriangle size={11} /> Action needed
                          </span>
                        )}
                      </div>
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

          {canToggle && (
            <div className="border-t border-slate-100 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
              >
                {expanded ? (
                  <>Show less <ChevronUp size={16} /></>
                ) : (
                  <>Show {items.length - COLLAPSED} more <ChevronDown size={16} /></>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

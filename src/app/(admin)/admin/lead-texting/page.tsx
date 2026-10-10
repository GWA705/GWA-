import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { smsEnabled } from '@/lib/sms';
import { leadTextConfig, renderLeadTextBody } from '@/lib/leadText';
import { LeadTextSettingsForm } from './LeadTextSettingsForm';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  SENT: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-700',
  OPTED_OUT: 'bg-gray-200 text-gray-600',
  SKIPPED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const KIND_LABEL: Record<string, string> = { CONFIRM: 'Confirm', DAY1: 'Day 1', MISSED_WINDOW: 'Missed-window' };

function maskPhone(e164: string): string {
  return e164.replace(/^(\+\d{2})\d+(\d{2})$/, '$1•••$2');
}

export default async function LeadTextingAdminPage() {
  await requireAdminSection('lead-texting');
  const cfg = await leadTextConfig();
  const [recent, optOutCount, pendingCount] = await Promise.all([
    prisma.leadTextOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.smsOptOut.count(),
    prisma.leadTextOutbox.count({ where: { status: 'PENDING' } }),
  ]);

  // Sample messages (what the customer receives), rendered server-side.
  const previews = [
    { label: 'Confirmation — in-store card (EN)', text: renderLeadTextBody('SCANNED', 'ON') },
    { label: 'Confirmation — mail-in card (EN)', text: renderLeadTextBody('MAILIN', 'ON') },
    { label: 'Confirmation — online HD lead (EN)', text: renderLeadTextBody('HD_SHEET', 'ON') },
    { label: 'Day-1 reminder (EN)', text: renderLeadTextBody('SCANNED', 'ON', 'DAY1') },
    { label: 'Missed-window — call again in 36h (EN)', text: renderLeadTextBody('SCANNED', 'ON', 'MISSED_WINDOW') },
    { label: 'Confirmation — Quebec (FR)', text: renderLeadTextBody('HD_SHEET', 'QC') },
    { label: 'Missed-window — Quebec (FR)', text: renderLeadTextBody('SCANNED', 'QC', 'MISSED_WINDOW') },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Lead auto-text</h1>
        <p className="mt-1 text-sm text-gray-500">
          When a new lead comes in (an in-store card, a mail-in card, or an online Home Depot lead), the
          customer gets one text letting them know we received their in-home water assessment request and a
          team member will call within 24–48 hours. Deduped so each customer is texted once, only within
          their local daytime window, with a STOP opt-out.
        </p>
      </div>

      {!smsEnabled() && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-semibold">Texting isn’t switched on yet.</span> Set <code>TWILIO_ACCOUNT_SID</code>,
          <code> TWILIO_AUTH_TOKEN</code> and <code>TWILIO_FROM_NUMBER</code> on Elastic Beanstalk, and verify the
          sending number for Canada (toll-free verification) — until then texts to Canadian numbers are blocked.
          See <Link href="/admin/email" className="underline">Admin → Email</Link> for the Twilio status + a test text.
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Settings</h2>
        <LeadTextSettingsForm
          config={{
            enabled: cfg.enabled,
            testMode: cfg.testMode,
            testNumber: cfg.testNumber ?? '',
            mediaUrl: cfg.mediaUrl ?? '',
            senderMap: cfg.senderMap && Object.keys(cfg.senderMap).length ? JSON.stringify(cfg.senderMap, null, 2) : '',
            quietStart: cfg.quietStart,
            quietEnd: cfg.quietEnd,
            followups: cfg.followups,
            day1Hours: cfg.day1Hours,
            missHours: cfg.missHours,
          }}
        />
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">What the customer gets</h2>
        <p className="mb-4 text-xs text-gray-500">MMS (with your image) is sent first; if it fails it falls back to a plain SMS of this text.</p>
        <div className="space-y-3">
          {previews.map((p) => (
            <div key={p.label} className="rounded-lg border border-gray-200 bg-slate-50/60 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{p.label}</div>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{p.text}</p>
              <div className="mt-1 text-[11px] text-gray-400">{p.text.length} characters</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent</h2>
          <div className="text-xs text-gray-500">{pendingCount} queued · {optOutCount} opted out</div>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing queued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-3">Customer</th>
                  <th className="py-1.5 pr-3">Phone</th>
                  <th className="py-1.5 pr-3">Message</th>
                  <th className="py-1.5 pr-3">Source</th>
                  <th className="py-1.5 pr-3">Status</th>
                  <th className="py-1.5">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.leadKey} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 text-gray-800">{r.customerName || '—'}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-500">{maskPhone(r.phone)}</td>
                    <td className="py-1.5 pr-3 text-xs text-gray-500">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{r.source}{r.province ? ` · ${r.province}` : ''}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.status}{r.channel ? ` · ${r.channel}` : ''}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs text-gray-400">{(r.sentAt ?? r.createdAt).toLocaleString('en-CA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

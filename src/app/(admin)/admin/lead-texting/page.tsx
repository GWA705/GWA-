import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { smsEnabled } from '@/lib/sms';
import { leadTextConfig, smsInfoUrl, getLeadTemplatesForEditor } from '@/lib/leadText';
import { getLeadTextPerformance } from '@/lib/leadTextReport';
import { LeadTextPerformance } from './LeadTextPerformance';
import { clickToCallConfig, twilioVoiceCredsPresent } from '@/lib/voice';
import { aiConfigured } from '@/lib/ai';
import { LeadTextSettingsForm } from './LeadTextSettingsForm';
import { VoiceSettingsForm } from './VoiceSettingsForm';
import { MessageTemplatesEditor } from './MessageTemplatesEditor';
import { LeadTextTabs } from './LeadTextTabs';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  SENT: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-700',
  OPTED_OUT: 'bg-gray-200 text-gray-600',
  SKIPPED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const KIND_LABEL: Record<string, string> = { CONFIRM: 'Confirm', DAY1: 'Day 1', MISSED_WINDOW: 'Missed-window', REACTIVATION: 'Reactivation' };

function maskPhone(e164: string): string {
  return e164.replace(/^(\+\d{2})\d+(\d{2})$/, '$1•••$2');
}

export default async function LeadTextingAdminPage({ searchParams }: { searchParams: { days?: string } }) {
  await requireAdminSection('lead-texting');
  const days = [30, 90, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 90;
  const cfg = await leadTextConfig();
  const vcfg = await clickToCallConfig();
  const [recent, optOutCount, pendingCount, offices] = await Promise.all([
    prisma.leadTextOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.smsOptOut.count(),
    prisma.leadTextOutbox.count({ where: { status: 'PENDING' } }),
    prisma.dealer.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const info = smsInfoUrl();
  const templates = await getLeadTemplatesForEditor();
  const perf = await getLeadTextPerformance(days);

  const messagesPanel = (
    <div className="card p-6">
      <h2 className="mb-1 text-base font-semibold text-gray-900">The messages</h2>
      <p className="mb-2 text-xs text-gray-500">
        Edit any message, drop in the customer&rsquo;s name or street, and see exactly how it lands on their phone.
        MMS (with your image) is tried first, falling back to plain SMS.
      </p>
      <p className="mb-4 rounded-md border border-gray-200 bg-slate-50/60 p-2.5 text-xs text-gray-500">
        <span className="font-medium text-gray-700">CASL:</span> every message identifies the sender, carries a STOP
        opt-out, and links to the public program-info &amp; opt-out page at{' '}
        <Link href="/sms" className="underline" target="_blank">/sms</Link>. Texting HELP returns our name and contact
        details automatically.
      </p>
      <MessageTemplatesEditor
        templates={templates}
        aiAvailable={aiConfigured()}
        bookingSample="https://portal.ghsbarrie.ca/book/sample"
        infoUrl={info}
      />
    </div>
  );

  const settingsPanel = (
    <div className="card p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Settings</h2>
      <LeadTextSettingsForm
        offices={offices}
        config={{
          enabled: cfg.enabled,
          testMode: cfg.testMode,
          testNumber: cfg.testNumber ?? '',
          mediaUrl: cfg.mediaUrl ?? '',
          senderMap: cfg.senderMap && Object.keys(cfg.senderMap).length ? JSON.stringify(cfg.senderMap, null, 2) : '',
          dealerAllowlist: cfg.dealerAllowlist,
          quietStart: cfg.quietStart,
          quietEnd: cfg.quietEnd,
          followups: cfg.followups,
          day1Hours: cfg.day1Hours,
          missHours: cfg.missHours,
          followupWorkdaysOnly: cfg.followupWorkdaysOnly,
          workdays: Array.from(cfg.followupWorkdays),
          bookingLink: cfg.bookingLink,
          reactivation: cfg.reactivation,
          reactivationDays: cfg.reactivationDays,
          reactivationMaxDays: cfg.reactivationMaxDays,
        }}
      />
    </div>
  );

  const liveCallPanel = (
    <div className="card p-6">
      <h2 className="mb-1 text-base font-semibold text-gray-900">Live call — &ldquo;talk to a booker now&rdquo;</h2>
      <p className="mb-4 text-xs text-gray-500">
        On the customer self-booking page, offer a live connect during staffed hours: the portal rings your bookers&rsquo;
        line, then dials the customer and bridges them. Only the number already on the lead is ever called.
      </p>
      <VoiceSettingsForm
        config={{
          clickToCall: vcfg.clickToCall,
          bookingLine: vcfg.bookingLine ?? '',
          fromNumber: vcfg.fromNumber ?? '',
          hoursStart: vcfg.hoursStart,
          hoursEnd: vcfg.hoursEnd,
        }}
        credsPresent={twilioVoiceCredsPresent()}
      />
    </div>
  );

  const activityPanel = (
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
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Lead auto-text</h1>
        <p className="mt-1 text-sm text-gray-500">
          When a new lead comes in (an in-store card, a mail-in card, or an online Home Depot lead), the
          customer gets one personalized text letting them know we received their request and a team member
          will call within 24–48 hours. Deduped, only within their local daytime window, with a STOP opt-out.
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

      <LeadTextTabs
        tabs={[
          { key: 'messages', label: 'Messages', content: messagesPanel },
          { key: 'performance', label: 'Performance', content: <LeadTextPerformance perf={perf} /> },
          { key: 'settings', label: 'Settings', content: settingsPanel },
          { key: 'call', label: 'Live call', content: liveCallPanel },
          { key: 'activity', label: 'Activity', content: activityPanel },
        ]}
      />
    </div>
  );
}

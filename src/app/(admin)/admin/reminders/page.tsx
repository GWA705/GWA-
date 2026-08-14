import { requireAdminSection } from '@/lib/session';
import { getReminderConfig } from '@/lib/reminders';
import { pushEnabled } from '@/lib/push';
import { emailEnabled } from '@/lib/email';
import { ReminderConfigForm } from './ReminderConfigForm';
import { ReminderRunner } from './ReminderRunner';
import { NewLeadRunner } from './NewLeadRunner';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  await requireAdminSection('reminders');
  const config = await getReminderConfig();
  const email = emailEnabled();
  const push = pushEnabled();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dealer reminders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Automatic nudges to a dealer by email and phone/desktop push when a deal is sitting in
          their court — approved and waiting for paperwork, conditionally approved, or flagged with a
          problem. Each message says what the deal is actually waiting for.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">How the standard schedule works</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li><span className="font-medium">First 24 hours:</span> nothing — the dealer gets the first day.</li>
          <li><span className="font-medium">Day 1:</span> two reminders — one in the morning, one in the afternoon (~3pm).</li>
          <li><span className="font-medium">Day 2:</span> once in the morning.</li>
          <li><span className="font-medium">Days 3–5:</span> every other day (day 3 and day 5), once each.</li>
          <li><span className="font-medium">After 5 days:</span> about twice a week, and each one is a ⚠️ priority message.</li>
          <li>Reminders only send between 8am and 9pm, never more than twice a day.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-400">
          These are the defaults — adjust any of them below.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Rule set</h2>
        <ReminderConfigForm config={config} />
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Run it now</h2>
        <p className="mb-4 text-sm text-gray-500">
          Sends any reminders that are due right now (the same work the schedule does automatically).
        </p>
        <ReminderRunner />
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">New-lead push notifications</h2>
        <p className="mb-4 text-sm text-gray-500">
          When a new Home Depot lead lands in the HD Leads Log, the dealer whose office owns that
          store gets a push notification to call the customer. Each lead pushes once. Dealers who
          don&apos;t want them can turn &ldquo;A new lead arrives&rdquo; off in their own account.
          Use the button to check right now (the first run just records existing leads as a baseline
          and sends nothing).
        </p>
        <NewLeadRunner />
        <p className="mt-4 rounded bg-brand-50 p-3 text-xs text-brand-800">
          The automatic check runs from a Render Cron Job that calls
          <code className="mx-1 rounded bg-brand-100 px-1">/api/cron/new-leads</code>
          every ~10 minutes with the <code className="rounded bg-brand-100 px-1">CRON_SECRET</code>.
          See docs/GO-LIVE-CHECKLIST.md for setup.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Delivery status</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className={`badge ${email ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            Email: {email ? 'sending' : 'log-only'}
          </span>
          <span className={`badge ${push ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            Push: {push ? 'configured' : 'not configured'}
          </span>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Reminders use both channels. If email is log-only, messages are written to the server log
          instead of sent (set up SMTP under Admin → Email). Push reaches a dealer&apos;s phone or
          desktop only after they turn on notifications (My account). Dealers can opt out of these
          reminders in their own account settings.
        </p>
        <p className="mt-3 rounded bg-brand-50 p-3 text-xs text-brand-800">
          The automatic schedule runs from a Render Cron Job that calls
          <code className="mx-1 rounded bg-brand-100 px-1">/api/cron/dealer-reminders</code>
          every ~15 minutes with the <code className="rounded bg-brand-100 px-1">CRON_SECRET</code>.
          See docs/REMINDERS.md for setup.
        </p>
      </div>
    </div>
  );
}

import { requireAdminSection } from '@/lib/session';
import { emailEnabled, getEmailIdentityInfo } from '@/lib/email';
import { TestEmailForm } from './TestEmailForm';
import { EmailIdentityForm } from './EmailIdentityForm';
import { AttentionAlertRunner } from './AttentionAlertRunner';

export const dynamic = 'force-dynamic';

export default async function EmailSettingsPage() {
  const admin = await requireAdminSection('email');
  const enabled = emailEnabled();
  const identity = await getEmailIdentityInfo();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Email</h1>

      <div className="card p-6">
        <div className="flex items-center gap-3">
          <span
            className={`badge ${enabled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {enabled ? 'Sending' : 'Log-only'}
          </span>
          <p className="text-sm text-gray-600">
            {enabled
              ? 'SMTP is configured — the portal is sending real emails.'
              : 'SMTP is not configured yet. Emails are written to the server log instead of being sent.'}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Who emails come from</h2>
        <p className="mb-4 text-sm text-gray-500">
          Set the group address the portal sends from and where replies go. Changes take effect immediately — no redeploy.
        </p>
        <EmailIdentityForm stored={identity.stored} effective={identity.effective} />
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Send a test email</h2>
        <p className="mb-4 text-sm text-gray-500">
          Confirms outgoing email works end-to-end. No personal information is included.
        </p>
        <TestEmailForm defaultTo={admin.email} enabled={enabled} />
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Reviewer 2-hour alert</h2>
        <p className="mb-4 text-sm text-gray-500">
          Reviewers/admins get an email when a <span className="font-medium">new deal or an uploaded
          document</span> has been waiting more than 2 hours without any reviewer looking at it. It
          only sends between 8am–10pm. Runs automatically on a schedule; use this button to check right now.
        </p>
        <AttentionAlertRunner />
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">How to turn on sending (Google Workspace)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-600">
          <li>
            In Google Workspace, use a real mailbox (e.g. <code className="rounded bg-gray-100 px-1">hello@ghsbarrie.ca</code>)
            with 2-Step Verification turned on.
          </li>
          <li>
            Create an <span className="font-medium">App Password</span> for that mailbox
            (Google Account → Security → App passwords). It&apos;s a 16-character code.
          </li>
          <li>
            In Render → your service → <span className="font-medium">Environment</span>, add:
            <div className="mt-2 overflow-x-auto rounded bg-gray-50 p-3 font-mono text-xs text-gray-700">
              <div>SMTP_HOST = smtp.gmail.com</div>
              <div>SMTP_PORT = 587</div>
              <div>SMTP_USER = hello@ghsbarrie.ca &nbsp;<span className="text-gray-400">(the mailbox that signs in)</span></div>
              <div>SMTP_PASS = &nbsp;<span className="text-gray-400">(the 16-char App Password — type it directly, no spaces)</span></div>
              <div>EMAIL_FROM = team@ghsbarrie.ca &nbsp;<span className="text-gray-400">(the group address emails come FROM)</span></div>
              <div>EMAIL_FROM_NAME = GWA Dealer Portal &nbsp;<span className="text-gray-400">(the display name)</span></div>
              <div>EMAIL_REPLY_TO = team@ghsbarrie.ca &nbsp;<span className="text-gray-400">(where replies go; defaults to EMAIL_FROM)</span></div>
            </div>
          </li>
          <li>Save — Render redeploys. Come back here; the badge should read <span className="font-medium">Sending</span>, then send a test.</li>
        </ol>
        <p className="mt-3 rounded bg-brand-50 p-3 text-xs text-brand-800">
          Emails are sent <span className="font-medium">from</span> your group address (<code className="rounded bg-brand-100 px-1">EMAIL_FROM</code>) and
          the <span className="font-medium">Reply-To</span> is set to the same group (or <code className="rounded bg-brand-100 px-1">EMAIL_REPLY_TO</code> if
          you want replies to go somewhere else), so anyone who replies reaches the whole team.
        </p>
        <p className="mt-3 rounded bg-amber-50 p-3 text-xs text-amber-800">
          If <code className="rounded bg-amber-100 px-1">EMAIL_FROM</code> is a different address than the
          <code className="mx-1 rounded bg-amber-100 px-1">SMTP_USER</code> mailbox, add it as a
          &quot;Send mail as&quot; alias on that mailbox in Gmail, or Google will rewrite the From line. Using a
          group/shared mailbox as both is simplest.
        </p>
      </div>
    </div>
  );
}

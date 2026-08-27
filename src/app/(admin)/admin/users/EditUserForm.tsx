'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { updateUserAction, signOutUserEverywhereAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

export function EditUserForm({
  user,
  dealers,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    dealerId: string | null;
    isDistributor: boolean;
    canUseCalculator: boolean;
    canViewReports: boolean;
    canViewLeadershipReport: boolean;
    canSearchCustomers: boolean;
    canViewDealerSnapshot: boolean;
    canManageGiftCards: boolean;
  };
  dealers: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(updateUserAction.bind(null, user.id), {} as ActionState);
  const [role, setRole] = useState(user.role);

  return (
    <>
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" required defaultValue={user.name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email (their login)</label>
          <input id="email" name="email" type="email" required defaultValue={user.email} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="DEALER_USER">Dealer user</option>
            <option value="REVIEWER">Reviewer (internal)</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dealerId">
            Dealer {role === 'DEALER_USER' ? '(required)' : '(optional — also gives dealer access)'}
          </label>
          <select id="dealerId" name="dealerId" className="input" defaultValue={user.dealerId ?? ''}>
            <option value="">—</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {role !== 'DEALER_USER' && (
            <p className="mt-1 text-xs text-gray-400">
              Linking a reviewer/admin to a dealer lets them switch into that dealer&apos;s portal.
            </p>
          )}
        </div>
        {role === 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="isDistributor" defaultChecked={user.isDistributor} className="mt-0.5 rounded border-gray-300" />
              <span>
                This person is the <strong>distributor</strong> (owner / main contact) for this dealer
                <span className="block text-xs text-gray-400">
                  Same access as a dealer user — flagged as the owner so you can send mail to distributors only.
                </span>
              </span>
            </label>
          </div>
        )}
        {role === 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="canUseCalculator" defaultChecked={user.canUseCalculator} className="mt-0.5 rounded border-gray-300" />
              <span>
                Give this person the <strong>payout calculator</strong>
                <span className="block text-xs text-gray-400">
                  Or turn it on for the whole dealership from Admin → Dealers (the “Calc” button).
                </span>
              </span>
            </label>
          </div>
        )}
        {role === 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="canViewReports" defaultChecked={user.canViewReports} className="mt-0.5 rounded border-gray-300" />
              <span>
                Give this person <strong>reports</strong> for their own office
                <span className="block text-xs text-gray-400">
                  They only ever see their own dealership&apos;s numbers. Or turn it on for the whole
                  dealership from Admin → Dealers (the “Reports” button).
                </span>
              </span>
            </label>
          </div>
        )}
        {role !== 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="canViewLeadershipReport" defaultChecked={user.canViewLeadershipReport} className="mt-0.5 rounded border-gray-300" />
              <span>
                Give this person the <strong>company-wide leadership snapshot</strong>
                <span className="block text-xs text-gray-400">
                  The weekly all-dealers / national report. Super Admins always have it; this grants it
                  to a specific reviewer/admin without making them a Super Admin.
                </span>
              </span>
            </label>
          </div>
        )}
        {role !== 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="canViewDealerSnapshot" defaultChecked={user.canViewDealerSnapshot} className="mt-0.5 rounded border-gray-300" />
              <span>
                Give this person the <strong>Dealer Snapshot report</strong>
                <span className="block text-xs text-gray-400">
                  The admin sold / paid / pending-per-dealer report (all dealers). Super Admins always have it; this
                  grants it to a specific reviewer/admin without making them a Super Admin.
                </span>
              </span>
            </label>
          </div>
        )}
        {role !== 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="canSearchCustomers" defaultChecked={user.canSearchCustomers} className="mt-0.5 rounded border-gray-300" />
              <span>
                Give this person the <strong>full customer search</strong>
                <span className="block text-xs text-gray-400">
                  Search every customer across all offices (for staff who field customer calls). Requires the global
                  search feature to be on (Admin → Security). Super Admins always have it.
                </span>
              </span>
            </label>
          </div>
        )}
        {role !== 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="canManageGiftCards" defaultChecked={user.canManageGiftCards} className="mt-0.5 rounded border-gray-300" />
              <span>
                Give this person <strong>gift-card access</strong>
                <span className="block text-xs text-gray-400">
                  Work the water-test gift-card queue (Staff → Gift cards): copy customer emails into Guusto and mark
                  them sent. Super Admins always have it; this grants it to a reviewer/admin without making them a Super
                  Admin.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="newPassword">New temporary password <span className="font-normal text-gray-400">(leave blank to keep current)</span></label>
          <input id="newPassword" name="newPassword" type="text" className="input" placeholder="Only fill this to reset their password" />
          <p className="mt-1 text-xs text-gray-400">
            If set: must be ≥8 chars with an uppercase, lowercase, number, and symbol. The user will be
            required to change it at their next login.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        <Link href="/admin/users" className="btn-secondary">Cancel</Link>
      </div>
    </form>

    <div className="mt-6 rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Devices &amp; sessions</h3>
      <p className="mt-1 text-xs text-gray-500">
        Signs this person out everywhere and forgets all their “trusted” devices, so their next
        sign-in needs a fresh 2FA code. Use if a phone or laptop is lost.
      </p>
      <form
        action={signOutUserEverywhereAction.bind(null, user.id)}
        onSubmit={(e) => {
          if (!confirm('Sign this user out of all devices? They will need to sign in again and enter a fresh 2FA code.')) e.preventDefault();
        }}
        className="mt-3"
      >
        <button type="submit" className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
          Sign out of all devices
        </button>
      </form>
    </div>
    </>
  );
}

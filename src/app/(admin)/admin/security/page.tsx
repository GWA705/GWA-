import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getMfaRequirement, isGlobalSearchEnabled, getMfaTrustDays } from '@/lib/settings';
import { SecuritySettingsForm } from './SecuritySettingsForm';
import { GlobalSearchToggle } from './GlobalSearchToggle';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  await requireAdminSection('security');
  const [requirement, trustDays, totalActive, withMfa, staffWithout, searchEnabled] = await Promise.all([
    getMfaRequirement(),
    getMfaTrustDays(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true, mfaEnabled: true } }),
    prisma.user.count({ where: { active: true, mfaEnabled: false, role: { in: ['REVIEWER', 'ADMIN'] } } }),
    isGlobalSearchEnabled(),
  ]);
  const without = totalActive - withMfa;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Security</h1>
        <p className="mt-1 text-sm text-gray-500">
          Two-factor authentication (2FA) adds a second step at sign-in, so a stolen password isn&apos;t
          enough to get in. Strongly recommended for anyone who can see customer information.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-4"><div className="text-xl font-semibold text-gray-800 tabular-nums">{withMfa}</div><div className="mt-0.5 text-xs text-gray-500">Have 2FA on</div></div>
        <div className="card p-4"><div className={`text-xl font-semibold tabular-nums ${without > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{without}</div><div className="mt-0.5 text-xs text-gray-500">Not yet set up</div></div>
        <div className="card p-4"><div className={`text-xl font-semibold tabular-nums ${staffWithout > 0 ? 'text-red-700' : 'text-green-700'}`}>{staffWithout}</div><div className="mt-0.5 text-xs text-gray-500">Staff without 2FA</div></div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Two-factor authentication</h2>
        <SecuritySettingsForm current={requirement} currentTrustDays={trustDays} />
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Customer search</h2>
        <p className="mb-4 text-sm text-gray-500">
          Lets internal staff search all customers (for when a customer calls GWA directly), and lets a dealer look up
          which office a customer is registered with — returning only the office name, contact and phone, never the
          customer&apos;s address or deal details. Off by default; every search is logged.
        </p>
        <GlobalSearchToggle enabled={searchEnabled} />
      </div>
    </div>
  );
}

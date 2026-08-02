import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getMfaRequirement } from '@/lib/settings';
import { SecuritySettingsForm } from './SecuritySettingsForm';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  await requireRole('ADMIN');
  const [requirement, totalActive, withMfa, staffWithout] = await Promise.all([
    getMfaRequirement(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true, mfaEnabled: true } }),
    prisma.user.count({ where: { active: true, mfaEnabled: false, role: { in: ['REVIEWER', 'ADMIN'] } } }),
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
        <SecuritySettingsForm current={requirement} />
      </div>
    </div>
  );
}

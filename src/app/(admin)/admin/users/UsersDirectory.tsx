'use client';

import { useState } from 'react';
import { UserRowActions } from './UserRowActions';

export type DirUser = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  mfaEnabled: boolean;
  active: boolean;
  canDelete: boolean;
  isSelf: boolean;
};

export type DirGroup = { key: string; name: string; users: DirUser[] };

/**
 * Admin users directory. Users are grouped (internal GWA staff, then each
 * dealer). A selector lets the admin narrow to one group and hide the rest, so
 * the page isn't one long scroll when there are many dealers.
 */
export function UsersDirectory({ groups }: { groups: DirGroup[] }) {
  const [selected, setSelected] = useState<string>('ALL');
  const total = groups.reduce((n, g) => n + g.users.length, 0);
  const shown = selected === 'ALL' ? groups : groups.filter((g) => g.key === selected);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <label className="label mb-0 text-xs" htmlFor="dealerFilter">
          Show
        </label>
        <select
          id="dealerFilter"
          className="input max-w-xs"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="ALL">All users ({total})</option>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name} ({g.users.length})
            </option>
          ))}
        </select>
        {selected !== 'ALL' && (
          <button type="button" className="btn-secondary text-xs" onClick={() => setSelected('ALL')}>
            Show all
          </button>
        )}
      </div>

      {shown.map((group) => (
        <div key={group.key} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">{group.name}</h2>
            <span className="badge bg-gray-100 text-gray-600">
              {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">2FA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">{u.roleLabel}</td>
                    <td className="px-4 py-3">{u.mfaEnabled ? '✓' : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!u.isSelf && (
                        <UserRowActions id={u.id} name={u.name} active={u.active} canDelete={u.canDelete} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

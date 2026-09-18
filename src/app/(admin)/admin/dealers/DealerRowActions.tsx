'use client';

import { toggleDealerActiveAction, toggleDealerCalculatorAction, toggleDealerReportsAction, toggleDealerInsightsAction, toggleDealerShowPayoutsAction, sendDigestTestAction, deleteDealerAction, viewAsDealerAction } from '@/app/(admin)/actions';

export function DealerRowActions({
  id,
  name,
  active,
  calculatorEnabled,
  reportsEnabled,
  insightsEnabled = false,
  showPayoutsToAllUsers = true,
  canDelete,
  align = 'end',
}: {
  id: string;
  name: string;
  active: boolean;
  calculatorEnabled: boolean;
  reportsEnabled: boolean;
  insightsEnabled?: boolean;
  showPayoutsToAllUsers?: boolean;
  canDelete: boolean;
  align?: 'start' | 'end';
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      <form action={viewAsDealerAction.bind(null, id)}>
        <button
          type="submit"
          className="btn-secondary text-xs"
          title="Open this dealer's portal exactly as they see it, to troubleshoot an issue. Your access is logged."
        >
          View as
        </button>
      </form>
      <form action={toggleDealerCalculatorAction.bind(null, id)}>
        <button
          type="submit"
          className={`text-xs ${calculatorEnabled ? 'btn-primary' : 'btn-secondary'}`}
          title="Give everyone at this dealership the payout calculator."
        >
          {calculatorEnabled ? 'Calc ✓' : 'Calc'}
        </button>
      </form>
      <form action={toggleDealerReportsAction.bind(null, id)}>
        <button
          type="submit"
          className={`text-xs ${reportsEnabled ? 'btn-primary' : 'btn-secondary'}`}
          title="Give everyone at this dealership reports for their own office only."
        >
          {reportsEnabled ? 'Reports ✓' : 'Reports'}
        </button>
      </form>
      <form action={toggleDealerInsightsAction.bind(null, id)}>
        <button
          type="submit"
          className={`text-xs ${insightsEnabled ? 'btn-primary' : 'btn-secondary'}`}
          title="Email this office the weekly + monthly insights digest (Snapshot). Off by default."
        >
          {insightsEnabled ? 'Digest ✓' : 'Digest'}
        </button>
      </form>
      <form action={toggleDealerShowPayoutsAction.bind(null, id)}>
        <button
          type="submit"
          className={`text-xs ${showPayoutsToAllUsers ? 'btn-primary' : 'btn-secondary'}`}
          title="Show the payout amount to EVERY user at this dealership. When off, only the owner/main contact sees payout dollars. On by default."
        >
          {showPayoutsToAllUsers ? 'Payouts ✓' : 'Payouts'}
        </button>
      </form>
      <form action={sendDigestTestAction.bind(null, id)}>
        <button
          type="submit"
          className="btn-secondary text-xs"
          title="Send this office's weekly digest to YOUR email only, to preview it. The dealer is not emailed."
        >
          Test digest
        </button>
      </form>
      <form action={toggleDealerActiveAction.bind(null, id)}>
        <button type="submit" className="btn-secondary text-xs">
          {active ? 'Archive' : 'Unarchive'}
        </button>
      </form>
      {canDelete ? (
        <form
          action={deleteDealerAction.bind(null, id)}
          onSubmit={(e) => {
            if (!window.confirm(`Delete “${name}” permanently? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className="btn-danger text-xs">Delete</button>
        </form>
      ) : (
        <span
          className="cursor-help text-xs text-gray-400"
          title="Only dealers with no users and no applications can be deleted. Archive this dealer instead."
        >
          Archive only
        </span>
      )}
    </div>
  );
}

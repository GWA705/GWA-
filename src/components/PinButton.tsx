'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { togglePinAction } from '@/app/(dealer)/actions';

/**
 * Pin / unpin a deal to the top of the dealer's Applications list. Per-user, so
 * a deal you're working on stays on page 1. Stops row-link navigation on click.
 */
export function PinButton({ applicationId, pinned }: { applicationId: string; pinned: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      await togglePinAction(applicationId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={pinned ? 'Unpin from top' : 'Pin to top'}
      aria-label={pinned ? 'Unpin from top' : 'Pin to top'}
      aria-pressed={pinned}
      className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-md transition disabled:opacity-40 ${
        pinned ? 'text-brand-600 hover:bg-brand-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      </svg>
    </button>
  );
}

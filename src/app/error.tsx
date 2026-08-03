'use client';

// Route-level error boundary. Without this, any unhandled error — including the
// common "stale browser tab posts to a Server Action ID that changed on the
// last deploy" case — shows Next's bare "Application error: a client-side
// exception has occurred" page, which the user can't recover from. This turns
// that into a friendly card with a working recovery path.
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the real error in the browser console / server logs for diagnosis.
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">
          That action didn&apos;t go through. This is usually temporary — most often it just means the app
          was updated while this page was open. Reloading almost always fixes it.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
        {error.digest && (
          <p className="mt-4 text-[11px] text-gray-400">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}

'use client';

// Last-resort boundary for errors thrown in the root layout, where the normal
// segment error.tsx can't render. Must supply its own <html>/<body> and can't
// rely on the app's stylesheet, so styles are inline.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#f8fafc' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
              This is usually temporary — reloading almost always fixes it.
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ background: '#ea580c', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={() => reset()}
                style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
            {error.digest && <p style={{ marginTop: 16, fontSize: 11, color: '#9ca3af' }}>Reference: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
